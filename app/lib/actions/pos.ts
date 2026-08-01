'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { upsertCustomerFromOrder } from '@/app/lib/customers'
import { sendPosReceipt } from '@/app/lib/email'

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

export interface PosSaleInput {
  items: { variantId: string; quantity: number }[]
  /** Apply sales tax at the store's configured rate (on the discounted subtotal). */
  taxable: boolean
  /** Optional whole-order discount. */
  discount?: PosDiscount | null
  /** One tender (single method) or two (2-way split). Amounts should sum to the total. */
  tenders: PosTender[]
  /** For a single cash tender: cash handed over, so we can record the change given. */
  cashTenderedCents?: number
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
  totalCents: number,
  changeCents: number,
): string {
  if (tenders.length === 1) {
    const t = tenders[0]
    if (t.method === 'Cash' && cashTenderedCents && cashTenderedCents > totalCents) {
      return `Cash — tendered ${money(cashTenderedCents)}, change ${money(changeCents)}`
    }
    return t.note ? `${t.method} · ${t.note}` : t.method
  }
  return (
    'Split: ' +
    tenders
      .map((t) => `${t.method} ${money(t.amountCents)}${t.note ? ` (${t.note})` : ''}`)
      .join(' + ')
  )
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
  | { ok: true; orderId: string; orderNumber: number; totalCents: number; changeCents: number }
  | { ok: false; error: string; soldOutVariantId?: string }
> {
  await requireAdmin()

  const items = (input.items ?? []).filter((i) => i.quantity > 0)
  if (items.length === 0) return { ok: false, error: 'Add at least one item.' }

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

  const subtotalCents = orderItems.reduce((s, i) => s + i.totalCents, 0)
  const discountCents = computeDiscountCents(subtotalCents, input.discount)
  const taxedBase = subtotalCents - discountCents
  const settings = await prisma.sM_Settings.findFirst({ where: { id: 'singleton' } })
  const taxRate = input.taxable ? settings?.taxRate ?? 0 : 0
  const taxCents = Math.round(taxedBase * taxRate)
  const totalCents = taxedBase + taxCents

  const changeCents =
    input.cashTenderedCents && input.cashTenderedCents > totalCents
      ? input.cashTenderedCents - totalCents
      : 0

  const tenders =
    input.tenders && input.tenders.length > 0
      ? input.tenders
      : [{ method: 'Cash', amountCents: totalCents }]
  const paymentNote = describeTenders(tenders, input.cashTenderedCents, totalCents, changeCents)

  const discountLabel =
    input.discount && discountCents > 0
      ? input.discount.mode === 'pct'
        ? `${input.discount.value}% off`
        : `${money(discountCents)} off`
      : null

  let order
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const res = await tx.sM_ProductVariant.updateMany({
          where: { id: it.variantId, stockQuantity: { gte: it.quantity } },
          data: { stockQuantity: { decrement: it.quantity } },
        })
        if (res.count !== 1) throw new Error(`OUT_OF_STOCK:${it.variantId}`)
      }
      return tx.sM_Order.create({
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
          paymentMethod: 'MANUAL',
          manualPaymentNote: paymentNote,
          paidAt: new Date(),
          items: {
            create: orderItems.map((oi) => ({
              variantId: oi.variantId,
              productName: oi.productName,
              variantName: oi.variantName,
              quantity: oi.quantity,
              unitCents: oi.unitCents,
              totalCents: oi.totalCents,
            })),
          },
        },
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
  return { ok: true, orderId: order.id, orderNumber: order.orderNumber, totalCents, changeCents }
}
