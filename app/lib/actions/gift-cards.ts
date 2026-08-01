'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import type { SM_GiftCardIssueReason } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'
import { parseGiftCode, formatGiftCode } from '@/app/lib/gift-cards'
import {
  GiftCardError,
  addToCard,
  createBlanks,
  deductFromCard,
  issueCard,
  voidCard,
} from '@/app/lib/gift-card-ledger'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

/** Turn a thrown GiftCardError into a message Mel can act on; anything else
 *  is a real bug and gets logged rather than surfaced. */
function toError(err: unknown, fallback: string): { ok: false; error: string } {
  if (err instanceof GiftCardError) return { ok: false, error: err.message }
  console.error('[gift-cards]', err)
  return { ok: false, error: fallback }
}

function refresh(id?: string) {
  revalidatePath('/admin/gift-cards')
  if (id) revalidatePath(`/admin/gift-cards/${id}`)
}

export async function issueGiftCard(input: {
  amountCents: number
  issueReason?: SM_GiftCardIssueReason
  recipientName?: string
  purchaserName?: string
  giftMessage?: string
  notes?: string
}): Promise<Result<{ id: string; code: string }>> {
  await requireAdmin()
  try {
    const card = await prisma.$transaction((tx) =>
      issueCard(tx, {
        amountCents: input.amountCents,
        issueReason: input.issueReason ?? 'MANUAL',
        recipientName: input.recipientName?.trim() || null,
        purchaserName: input.purchaserName?.trim() || null,
        giftMessage: input.giftMessage?.trim() || null,
        notes: input.notes?.trim() || null,
        actor: 'admin',
      }),
    )
    refresh(card.id)
    return { ok: true, id: card.id, code: card.code }
  } catch (err) {
    return toError(err, 'Could not issue the certificate.')
  }
}

/** Print a run of blank certificates to fill in later. */
export async function createBlankBatch(
  count: number,
): Promise<Result<{ batchId: string; codes: string[] }>> {
  await requireAdmin()
  const n = Math.round(count)
  if (!Number.isFinite(n) || n < 1 || n > 100) {
    return { ok: false, error: 'Pick a batch size between 1 and 100.' }
  }
  try {
    const batchId = randomUUID()
    const cards = await prisma.$transaction((tx) => createBlanks(tx, n, batchId))
    refresh()
    return { ok: true, batchId, codes: cards.map((c) => c.code) }
  } catch (err) {
    return toError(err, 'Could not create the batch.')
  }
}

/** Activate a printed blank — the counterpart to createBlankBatch. */
export async function activateBlank(input: {
  cardId: string
  amountCents: number
  recipientName?: string
  purchaserName?: string
  giftMessage?: string
}): Promise<Result> {
  await requireAdmin()
  try {
    await prisma.$transaction((tx) =>
      issueCard(tx, {
        existingCardId: input.cardId,
        amountCents: input.amountCents,
        issueReason: 'PURCHASE',
        recipientName: input.recipientName?.trim() || null,
        purchaserName: input.purchaserName?.trim() || null,
        giftMessage: input.giftMessage?.trim() || null,
        actor: 'admin',
      }),
    )
    refresh(input.cardId)
    return { ok: true }
  } catch (err) {
    return toError(err, 'Could not activate the certificate.')
  }
}

export async function reloadGiftCard(cardId: string, amountCents: number): Promise<Result> {
  await requireAdmin()
  try {
    await prisma.$transaction((tx) =>
      addToCard(tx, { cardId, amountCents, type: 'RELOAD', actor: 'admin' }),
    )
    refresh(cardId)
    return { ok: true }
  } catch (err) {
    return toError(err, 'Could not add value to the certificate.')
  }
}

/** Manual correction. amountCents is SIGNED — positive adds, negative takes
 *  away. A reason is mandatory either way; this is the one path that can move
 *  money without a sale behind it. */
export async function adjustGiftCard(
  cardId: string,
  amountCents: number,
  reason: string,
): Promise<Result> {
  await requireAdmin()
  const why = reason.trim()
  if (!why) return { ok: false, error: 'A reason is required for a manual adjustment.' }
  if (!amountCents) return { ok: false, error: 'Enter an amount.' }
  try {
    await prisma.$transaction((tx) =>
      amountCents > 0
        ? addToCard(tx, { cardId, amountCents, type: 'ADJUST', reason: why, actor: 'admin' })
        : deductFromCard(tx, { cardId, amountCents: -amountCents, reason: why, actor: 'admin' }),
    )
    refresh(cardId)
    return { ok: true }
  } catch (err) {
    return toError(err, 'Could not adjust the certificate.')
  }
}

export async function voidGiftCard(cardId: string, reason: string): Promise<Result> {
  await requireAdmin()
  const why = reason.trim()
  if (!why) return { ok: false, error: 'Say why you are voiding it — this cannot be undone.' }
  try {
    await prisma.$transaction((tx) => voidCard(tx, { cardId, reason: why, actor: 'admin' }))
    refresh(cardId)
    return { ok: true }
  } catch (err) {
    return toError(err, 'Could not void the certificate.')
  }
}

export async function updateGiftCardNotes(cardId: string, notes: string): Promise<Result> {
  await requireAdmin()
  try {
    await prisma.sM_GiftCard.update({
      where: { id: cardId },
      data: { notes: notes.trim() || null },
    })
    refresh(cardId)
    return { ok: true }
  } catch (err) {
    return toError(err, 'Could not save the note.')
  }
}

export interface GiftCardLookup {
  id: string
  code: string
  formattedCode: string
  status: string
  balanceCents: number
  recipientName: string | null
}

/**
 * Look a certificate up by typed code. Admin-gated, so no rate limiting is
 * needed here — that only matters if this is ever exposed publicly.
 */
export async function lookupGiftCard(
  rawCode: string,
): Promise<Result<{ card: GiftCardLookup }>> {
  await requireAdmin()
  const code = parseGiftCode(rawCode)
  if (!code) {
    return { ok: false, error: "That doesn't look like a valid certificate number." }
  }
  const card = await prisma.sM_GiftCard.findUnique({ where: { code } })
  if (!card) return { ok: false, error: 'No certificate found with that number.' }
  if (card.status === 'VOID') return { ok: false, error: 'That certificate has been voided.' }
  if (card.status === 'UNISSUED') {
    return { ok: false, error: 'That certificate has not been activated yet.' }
  }
  if (card.balanceCents <= 0) {
    return { ok: false, error: 'That certificate has no balance left.' }
  }
  return {
    ok: true,
    card: {
      id: card.id,
      code: card.code,
      formattedCode: formatGiftCode(card.code),
      status: card.status,
      balanceCents: card.balanceCents,
      recipientName: card.recipientName,
    },
  }
}
