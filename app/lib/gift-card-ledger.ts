/**
 * The gift certificate money layer.
 *
 * Every function here takes a Prisma transaction client so callers can fold a
 * card movement into a larger transaction — the POS redeems a card in the same
 * transaction that decrements stock and creates the order, so a sale can never
 * half-happen.
 *
 * Two rules, both load-bearing:
 *
 *  1. Never move balanceCents without writing a SM_GiftCardTxn row in the same
 *     transaction. The ledger is the source of truth; balanceCents is a cache.
 *  2. Balance changes go through a CONDITIONAL updateMany that re-checks status
 *     and (for spends) sufficient funds. Reading a balance and then writing it
 *     back would let two concurrent redemptions both pass the check and
 *     overdraw the card. Same pattern the POS uses for stock.
 *
 * This module is deliberately NOT a 'use server' file: these are unauthenticated
 * money mutations and must never be reachable as server actions from a browser.
 * app/lib/actions/gift-cards.ts wraps them with requireAdmin().
 */

import type { Prisma, SM_GiftCard, SM_GiftCardIssueReason } from '@prisma/client'
import { generateGiftCode, giftCardLast4 } from './gift-cards'

export type Tx = Prisma.TransactionClient

export class GiftCardError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'NOT_ACTIVE' | 'INSUFFICIENT' | 'ALREADY_ISSUED' | 'BAD_AMOUNT',
    message: string,
  ) {
    super(message)
    this.name = 'GiftCardError'
  }
}

/**
 * Reserve a unique code. The unique index is the real arbiter; we retry a few
 * times in the (vanishingly unlikely, 50-bit) event of a collision.
 */
async function uniqueCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGiftCode()
    const clash = await tx.sM_GiftCard.findUnique({ where: { code }, select: { id: true } })
    if (!clash) return code
  }
  throw new Error('Could not generate a unique gift card code')
}

/** Print a run of blanks. They carry no money until activated, so a stolen
 *  stack is a stationery loss, not a cash loss. */
export async function createBlanks(
  tx: Tx,
  count: number,
  batchId: string,
): Promise<SM_GiftCard[]> {
  const made: SM_GiftCard[] = []
  for (let i = 0; i < count; i++) {
    const code = await uniqueCode(tx)
    made.push(
      await tx.sM_GiftCard.create({
        data: { code, last4: giftCardLast4(code), status: 'UNISSUED', batchId },
      }),
    )
  }
  return made
}

export interface IssueInput {
  amountCents: number
  issueReason?: SM_GiftCardIssueReason
  recipientName?: string | null
  purchaserName?: string | null
  giftMessage?: string | null
  notes?: string | null
  /** The order that sold this card, when it was sold rather than granted. */
  orderId?: string | null
  /** Activate this existing blank instead of minting a new code. */
  existingCardId?: string | null
  actor?: string
}

/**
 * Activate a card and load its opening value. Either mints a new code or
 * activates an existing UNISSUED blank.
 */
export async function issueCard(tx: Tx, input: IssueInput): Promise<SM_GiftCard> {
  const amountCents = Math.round(input.amountCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new GiftCardError('BAD_AMOUNT', 'Enter an amount greater than zero.')
  }

  let card: SM_GiftCard
  if (input.existingCardId) {
    // Conditional: only an UNISSUED blank can be activated, and only once.
    const res = await tx.sM_GiftCard.updateMany({
      where: { id: input.existingCardId, status: 'UNISSUED' },
      data: {
        status: 'ACTIVE',
        initialCents: amountCents,
        balanceCents: amountCents,
        issueReason: input.issueReason ?? 'PURCHASE',
        recipientName: input.recipientName ?? null,
        purchaserName: input.purchaserName ?? null,
        giftMessage: input.giftMessage ?? null,
        notes: input.notes ?? null,
        issuedOnOrderId: input.orderId ?? null,
        issuedAt: new Date(),
      },
    })
    if (res.count !== 1) {
      throw new GiftCardError('ALREADY_ISSUED', 'That card has already been issued.')
    }
    card = (await tx.sM_GiftCard.findUniqueOrThrow({ where: { id: input.existingCardId } }))
  } else {
    const code = await uniqueCode(tx)
    card = await tx.sM_GiftCard.create({
      data: {
        code,
        last4: giftCardLast4(code),
        status: 'ACTIVE',
        initialCents: amountCents,
        balanceCents: amountCents,
        issueReason: input.issueReason ?? 'PURCHASE',
        recipientName: input.recipientName ?? null,
        purchaserName: input.purchaserName ?? null,
        giftMessage: input.giftMessage ?? null,
        notes: input.notes ?? null,
        issuedOnOrderId: input.orderId ?? null,
        issuedAt: new Date(),
      },
    })
  }

  await tx.sM_GiftCardTxn.create({
    data: {
      giftCardId: card.id,
      type: 'ISSUE',
      amountCents,
      balanceAfterCents: amountCents,
      orderId: input.orderId ?? null,
      actor: input.actor ?? 'admin',
    },
  })

  return card
}

/**
 * Spend against a card. Returns how much was actually taken.
 *
 * idempotencyKey is unique in the database, so a retried request rolls the
 * whole transaction back on the constraint rather than spending twice — which
 * is exactly why the ledger row is written inside the same transaction as the
 * balance decrement.
 */
export async function redeemFromCard(
  tx: Tx,
  input: {
    cardId: string
    amountCents: number
    orderId?: string | null
    idempotencyKey?: string | null
    actor?: string
  },
): Promise<number> {
  const amountCents = Math.round(input.amountCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new GiftCardError('BAD_AMOUNT', 'Redemption amount must be greater than zero.')
  }

  // Conditional decrement — re-checks ACTIVE and sufficient funds atomically.
  const res = await tx.sM_GiftCard.updateMany({
    where: { id: input.cardId, status: 'ACTIVE', balanceCents: { gte: amountCents } },
    data: { balanceCents: { decrement: amountCents }, lastRedeemedAt: new Date() },
  })
  if (res.count !== 1) {
    const card = await tx.sM_GiftCard.findUnique({ where: { id: input.cardId } })
    if (!card) throw new GiftCardError('NOT_FOUND', 'That gift certificate does not exist.')
    if (card.status !== 'ACTIVE') {
      throw new GiftCardError(
        'NOT_ACTIVE',
        card.status === 'VOID'
          ? 'That certificate has been voided.'
          : 'That certificate has not been activated yet.',
      )
    }
    throw new GiftCardError('INSUFFICIENT', 'That certificate does not have enough left on it.')
  }

  const after = await tx.sM_GiftCard.findUniqueOrThrow({
    where: { id: input.cardId },
    select: { balanceCents: true },
  })

  await tx.sM_GiftCardTxn.create({
    data: {
      giftCardId: input.cardId,
      type: 'REDEEM',
      amountCents: -amountCents, // signed: spends are negative
      balanceAfterCents: after.balanceCents,
      orderId: input.orderId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      actor: input.actor ?? 'pos',
    },
  })

  return amountCents
}

/** Add value to an already-active card: a reload, a refund back onto it, or a
 *  positive manual correction. */
export async function addToCard(
  tx: Tx,
  input: {
    cardId: string
    amountCents: number
    type: 'RELOAD' | 'REFUND_TO_CARD' | 'ADJUST'
    orderId?: string | null
    reason?: string | null
    actor?: string
  },
): Promise<number> {
  const amountCents = Math.round(input.amountCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new GiftCardError('BAD_AMOUNT', 'Enter an amount greater than zero.')
  }

  const res = await tx.sM_GiftCard.updateMany({
    where: { id: input.cardId, status: 'ACTIVE' },
    data: { balanceCents: { increment: amountCents } },
  })
  if (res.count !== 1) {
    throw new GiftCardError('NOT_ACTIVE', 'Only an active certificate can take value.')
  }

  const after = await tx.sM_GiftCard.findUniqueOrThrow({
    where: { id: input.cardId },
    select: { balanceCents: true },
  })

  await tx.sM_GiftCardTxn.create({
    data: {
      giftCardId: input.cardId,
      type: input.type,
      amountCents,
      balanceAfterCents: after.balanceCents,
      orderId: input.orderId ?? null,
      reason: input.reason ?? null,
      actor: input.actor ?? 'admin',
    },
  })

  return after.balanceCents
}

/** Manual correction downward. Signed negative in the ledger; reason required. */
export async function deductFromCard(
  tx: Tx,
  input: { cardId: string; amountCents: number; reason: string; actor?: string },
): Promise<number> {
  const amountCents = Math.round(input.amountCents)
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new GiftCardError('BAD_AMOUNT', 'Enter an amount greater than zero.')
  }

  const res = await tx.sM_GiftCard.updateMany({
    where: { id: input.cardId, status: 'ACTIVE', balanceCents: { gte: amountCents } },
    data: { balanceCents: { decrement: amountCents } },
  })
  if (res.count !== 1) {
    throw new GiftCardError('INSUFFICIENT', 'That would take the balance below zero.')
  }

  const after = await tx.sM_GiftCard.findUniqueOrThrow({
    where: { id: input.cardId },
    select: { balanceCents: true },
  })

  await tx.sM_GiftCardTxn.create({
    data: {
      giftCardId: input.cardId,
      type: 'ADJUST',
      amountCents: -amountCents,
      balanceAfterCents: after.balanceCents,
      reason: input.reason,
      actor: input.actor ?? 'admin',
    },
  })

  return after.balanceCents
}

/** Kill a card: zero the balance with a matching negative row, then VOID it.
 *  Voiding is terminal — there is no un-void. */
export async function voidCard(
  tx: Tx,
  input: { cardId: string; reason: string; actor?: string },
): Promise<void> {
  const card = await tx.sM_GiftCard.findUnique({ where: { id: input.cardId } })
  if (!card) throw new GiftCardError('NOT_FOUND', 'That gift certificate does not exist.')
  if (card.status === 'VOID') return // already dead; nothing to do

  const res = await tx.sM_GiftCard.updateMany({
    where: { id: input.cardId, status: card.status },
    data: { status: 'VOID', balanceCents: 0 },
  })
  if (res.count !== 1) {
    throw new GiftCardError('NOT_ACTIVE', 'The certificate changed while you were voiding it.')
  }

  if (card.balanceCents !== 0) {
    await tx.sM_GiftCardTxn.create({
      data: {
        giftCardId: input.cardId,
        type: 'VOID',
        amountCents: -card.balanceCents,
        balanceAfterCents: 0,
        reason: input.reason,
        actor: input.actor ?? 'admin',
      },
    })
  }
}
