'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { upsertCustomerFromOrder } from '@/app/lib/customers'
import { sendPosReceipt } from '@/app/lib/email'
import { formatGiftCode } from '@/app/lib/gift-cards'
import { GiftCardError, issueCard, redeemFromCard } from '@/app/lib/gift-card-ledger'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** One leg of the tender. A single-method sale has one; a split has two. */
export interface PosTender {
  /** "Cash", "Venmo", "Cash App", "Card" */
  method: string
  /** Amount applied to this leg, in cents. */
  amountCents: number
  /** Optional reference (e.g. a Venmo handle or card last-4). */
  note?: string
}

export interface PosDiscount {
  /** 'pct' = percentage off (value 0–100); 'amt' = fixed dollars off (value in cents). */
  mode: 'pct' | 'amt'
  value: number
}

/** A gift certificate being SOLD on this sale. */
export interface PosGiftCardSale {
  amountCents: number
  recipientName?: string
  purchaserName?: string
  giftMessage?: string
}

export interface PosSaleInput {
  items: { variantId: string; quantity: number }[]
  /** Apply sales tax at the store's configured rate (on the discounted merchandise). */
  taxable: boolean
  /** Optional whole-order discount. Applies to merchandise only. */
  discount?: PosDiscount | null
  /** One tender (single method) or two (2-way split). Amounts should sum to the amount due. */
  tenders: PosTender[]
  /** For a single cash tender: cash handed over, so we can record the change given. */
  cashTenderedCents?: number
  /** Certificates being sold. Never taxed and never discounted — see the
   *  money-model note in the schema. */
  giftCardsSold?: PosGiftCardSale[]
  /** A certificate being SPENT. This is a tender, not a discount: it comes off
   *  the total after tax, so it never shrinks the taxable base. */
  giftCardPayment?: { cardId: string; amountCents: number } | null
  /** Stable id for one checkout attempt, generated once by the browser. Makes
   *  a redemption idempotent so a double-tap can't spend the card twice. */
  clientSaleId?: string
  /** Optional customer capture (never blocks the sale). */
  customerName?: string
  customerEmail?: string
  customerPhone?: string
}

function computeDiscountCents(subtotalCents: number, discount?: PosDiscount | null): number {
  if (!discount || discount.value <= 0) return 0
  const raw =
    discount.mode === 'pct'
      ? Math.round((subtotalCents * Math.min(discount.value, 100)) / 100)
      : Math.round(discount.value)
  return Math.max(0, Math.min(raw, subtotalCents)) // never exceed the subtotal
}

function describeTenders(
  tenders: PosTender[],
  cashTenderedCents: number | undefined,
  amountDueCents: number,
  changeCents: number,
  giftCard?: { code: string; amountCents: number } | null,
): string {
  const gift = giftCard ? `Gift cert ${giftCard.code} ${money(giftCard.amountCents)}` : null

  // Fully covered by a certificate — there is no cash leg to describe.
  if (amountDueCents <= 0 && gift) return gift

  let base: string
  if (tenders.length === 1) {
    const t = tenders[0]
    base =
      t.method === 'Cash' && cashTenderedCents && cashTenderedCents > amountDueCents
        ? `Cash — tendered ${money(cashTenderedCents)}, change ${money(changeCents)}`
        : t.note
          ? `${t.method} · ${t.note}`
          : t.method
  } else {
    base =
      'Split: ' +
      tenders
        .map((t) => `${t.method} ${money(t.amountCents)}${t.note ? ` (${t.note})` : ''}`)
        .join(' + ')
  }

  return gift ? `${gift} + ${base}` : base
}

/**
 * Rings up an in-person (market / walk-up) sale. The sale is completed and
 * paid in hand, so the order is created PAID + MANUAL + PICKUP and stock is
 * decremented atomically (conditional updateMany, same TOCTOU guard as online
 * checkout) so a concurrent web order can't oversell. Supports a whole-order
 * discount, a 2-way split tender, cash change tracking, and optional customer
 * capture (which also emails a receipt once SMTP is configured).
 */
export async function createPosSale(
  input: PosSaleInput,
): Promise<
  | {
      ok: true
      orderId: string
      orderNumber: number
      totalCents: number
      changeCents: number
      giftCardCents: number
      /** Certificates minted by this sale, so the till can print them. */
      issuedGiftCards: { id: string; code: string; amountCents: number }[]
    }
  | { ok: false; error: string; soldOutVariantId?: string }
> {
  await requireAdmin()

  const items = (input.items ?? []).filter((i) => i.quantity > 0)
  const giftCardsSold = (input.giftCardsSold ?? []).filter((g) => g.amountCents > 0)
  if (items.length === 0 && giftCardsSold.length === 0) {
    return { ok: false, error: 'Add at least one item.' }
  }
  for (const g of giftCardsSold) {
    if (!Number.isFinite(g.amountCents) || g.amountCents <= 0) {
      return { ok: false, error: 'Enter an amount for the gift certificate.' }
    }
  }

  const variantIds = items.map((i) => i.variantId)
  const variants = await prisma.sM_ProductVariant.findMany({
    where: { id: { in: variantIds } },
    include: { product: true },
  })
  const vMap = new Map(variants.map((v) => [v.id, v]))

  const orderItems: {
    variantId: string
    productName: string
    variantName: string
    quantity: number
    unitCents: number
    totalCents: number
  }[] = []
  for (const it of items) {
    const v = vMap.get(it.variantId)
    if (!v) return { ok: false, error: 'A selected product no longer exists.' }
    if (v.stockQuantity < it.quantity) {
      return {
        ok: false,
        error: `Not enough stock for "${v.name}" (have ${v.stockQuantity}).`,
        soldOutVariantId: v.id,
      }
    }
    orderItems.push({
      variantId: v.id,
      productName: v.product.name,
      variantName: v.name,
      quantity: it.quantity,
      unitCents: v.priceCents,
      totalCents: v.priceCents * it.quantity,
    })
  }

  // Merchandise and certificates are kept apart on purpose. A certificate is
  // never taxed and never discounted at point of sale — tax is charged later,
  // on the full price of whatever it eventually buys.
  const merchSubtotalCents = orderItems.reduce((s, i) => s + i.totalCents, 0)
  const giftCardSoldCents = giftCardsSold.reduce((s, g) => s + Math.round(g.amountCents), 0)
  const subtotalCents = merchSubtotalCents + giftCardSoldCents

  const discountCents = computeDiscountCents(merchSubtotalCents, input.discount)
  const taxedBase = merchSubtotalCents - discountCents
  const settings = await prisma.sM_Settings.findFirst({ where: { id: 'singleton' } })
  const taxRate = input.taxable ? settings?.taxRate ?? 0 : 0
  const taxCents = Math.round(taxedBase * taxRate)
  // totalCents stays the full price of the sale. A redeemed certificate does
  // NOT reduce it — that's a tender, applied below.
  const totalCents = taxedBase + taxCents + giftCardSoldCents

  // Validate the certificate being spent, before we touch anything.
  let payingCard: { id: string; code: string; balanceCents: number } | null = null
  let giftCardCents = 0
  if (input.giftCardPayment && input.giftCardPayment.amountCents > 0) {
    const card = await prisma.sM_GiftCard.findUnique({
      where: { id: input.giftCardPayment.cardId },
      select: { id: true, code: true, balanceCents: true, status: true },
    })
    if (!card) return { ok: false, error: 'That gift certificate no longer exists.' }
    if (card.status !== 'ACTIVE') {
      return { ok: false, error: 'That gift certificate is not active.' }
    }
    // A certificate can't buy another certificate: it would launder a
    // liability into a fresh one and never settle as real income.
    const redeemableCents = totalCents - giftCardSoldCents
    if (redeemableCents <= 0) {
      return {
        ok: false,
        error: "A gift certificate can't be used to pay for another gift certificate.",
      }
    }
    giftCardCents = Math.min(
      Math.round(input.giftCardPayment.amountCents),
      card.balanceCents,
      redeemableCents,
    )
    if (giftCardCents <= 0) {
      return { ok: false, error: 'That certificate has no balance left to apply.' }
    }
    payingCard = { id: card.id, code: card.code, balanceCents: card.balanceCents }
  }

  const amountDueCents = totalCents - giftCardCents

  const changeCents =
    input.cashTenderedCents && input.cashTenderedCents > amountDueCents
      ? input.cashTenderedCents - amountDueCents
      : 0

  const tenders =
    input.tenders && input.tenders.length > 0
      ? input.tenders
      : amountDueCents > 0
        ? [{ method: 'Cash', amountCents: amountDueCents }]
        : []
  const paymentNote = describeTenders(
    tenders,
    input.cashTenderedCents,
    amountDueCents,
    changeCents,
    payingCard ? { code: formatGiftCode(payingCard.code), amountCents: giftCardCents } : null,
  )

  const discountLabel =
    input.discount && discountCents > 0
      ? input.discount.mode === 'pct'
        ? `${input.discount.value}% off`
        : `${money(discountCents)} off`
      : null

  let order
  const issuedGiftCards: { id: string; code: string; amountCents: number }[] = []
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const res = await tx.sM_ProductVariant.updateMany({
          where: { id: it.variantId, stockQuantity: { gte: it.quantity } },
          data: { stockQuantity: { decrement: it.quantity } },
        })
        if (res.count !== 1) throw new Error(`OUT_OF_STOCK:${it.variantId}`)
      }

      const created = await tx.sM_Order.create({
        data: {
          status: 'PAID',
          fulfillment: 'PICKUP',
          customerName: input.customerName?.trim() || 'In-person sale',
          customerEmail: input.customerEmail?.trim() || 'pos@smellymellys.net',
          customerPhone: input.customerPhone?.trim() || null,
          subtotalCents,
          shippingCents: 0,
          discountCents,
          discountCode: discountLabel,
          taxCents,
          totalCents,
          giftCardCents,
          paymentMethod: 'MANUAL',
          manualPaymentNote: paymentNote,
          paidAt: new Date(),
          items: {
            create: orderItems.map((oi) => ({
              kind: 'PRODUCT' as const,
              variantId: oi.variantId,
              productName: oi.productName,
              variantName: oi.variantName,
              quantity: oi.quantity,
              unitCents: oi.unitCents,
              totalCents: oi.totalCents,
            })),
          },
        },
      })

      // Mint each certificate sold, then hang a GIFT_CARD line off the order
      // for it. Done after the order exists so every ledger row can carry the
      // orderId that paid for it.
      for (const g of giftCardsSold) {
        const amountCents = Math.round(g.amountCents)
        const card = await issueCard(tx, {
          amountCents,
          issueReason: 'PURCHASE',
          recipientName: g.recipientName?.trim() || null,
          purchaserName: g.purchaserName?.trim() || null,
          giftMessage: g.giftMessage?.trim() || null,
          orderId: created.id,
          actor: 'pos',
        })
        await tx.sM_OrderItem.create({
          data: {
            orderId: created.id,
            kind: 'GIFT_CARD',
            giftCardId: card.id,
            productName: 'Gift Certificate',
            variantName: formatGiftCode(card.code),
            quantity: 1,
            unitCents: amountCents,
            totalCents: amountCents,
          },
        })
        issuedGiftCards.push({ id: card.id, code: card.code, amountCents })
      }

      // Spend the paying certificate last, inside the same transaction: if it
      // has been drained on another till since we checked, everything above
      // rolls back rather than handing over goods for nothing.
      if (payingCard && giftCardCents > 0) {
        await redeemFromCard(tx, {
          cardId: payingCard.id,
          amountCents: giftCardCents,
          orderId: created.id,
          idempotencyKey: input.clientSaleId
            ? `pos:${input.clientSaleId}:${payingCard.id}`
            : null,
          actor: 'pos',
        })
      }

      return tx.sM_Order.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: true },
      })
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.startsWith('OUT_OF_STOCK')) {
      const soldOutVariantId = msg.split(':')[1] || undefined
      const v = soldOutVariantId ? vMap.get(soldOutVariantId) : undefined
      return {
        ok: false,
        error: v
          ? `"${v.name}" just sold out while you were ringing up. Remove it to continue.`
          : 'An item just sold out — refresh and try again.',
        soldOutVariantId,
      }
    }
    // A card problem is Mel's to fix at the till, so it gets its own message.
    if (err instanceof GiftCardError) {
      return { ok: false, error: `${err.message} Nothing was charged.` }
    }
    // A double-tap replays the same clientSaleId and trips the unique
    // idempotencyKey on the redemption row. The card was NOT spent twice —
    // but the first sale did go through, so never tell Mel to "try again"
    // here or she'll ring the order a second time.
    if (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'P2002' &&
      String((err as { meta?: { target?: unknown } }).meta?.target ?? '').includes(
        'idempotencyKey',
      )
    ) {
      return {
        ok: false,
        error:
          'This sale was already rung up — the certificate was only charged once. Check Orders before ringing it again.',
      }
    }
    console.error('POS sale failed:', err)
    return { ok: false, error: 'Could not complete the sale. Nothing was charged — try again.' }
  }

  // Only link a customer row + email a receipt when a real email was captured
  // (skip the POS placeholder). Both are best-effort; a failure never unwinds
  // a completed, paid, stock-decremented sale.
  if (input.customerEmail?.trim()) {
    try {
      await upsertCustomerFromOrder(order)
    } catch (e) {
      console.error(`[crm] POS upsert for ${order.id} failed:`, e)
    }
    try {
      await sendPosReceipt(order)
    } catch (e) {
      console.error(`[email] POS receipt for ${order.id} failed:`, e)
    }
  }

  revalidatePath('/admin/pos')
  revalidatePath('/admin/orders')
  revalidatePath('/admin/inventory')
  if (issuedGiftCards.length > 0 || giftCardCents > 0) revalidatePath('/admin/gift-cards')
  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalCents,
    changeCents,
    giftCardCents,
    issuedGiftCards,
  }
}
