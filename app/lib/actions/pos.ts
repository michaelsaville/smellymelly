'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { upsertCustomerFromOrder } from '@/app/lib/customers'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

export interface PosSaleInput {
  items: { variantId: string; quantity: number }[]
  /** Apply sales tax at the store's configured rate. */
  taxable: boolean
  /** Free-form tender note, e.g. "Cash", "Venmo", "Square terminal". */
  paymentNote?: string
  customerName?: string
  customerEmail?: string
}

/**
 * Rings up an in-person (market / walk-up) sale. The sale is completed and
 * paid in hand, so the order is created PAID + MANUAL + PICKUP and stock is
 * decremented atomically (conditional updateMany, same TOCTOU guard as online
 * checkout) so a concurrent web order can't oversell.
 */
export async function createPosSale(
  input: PosSaleInput,
): Promise<{ ok: true; orderId: string; orderNumber: number } | { ok: false; error: string }> {
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
      return { ok: false, error: `Not enough stock for "${v.name}" (have ${v.stockQuantity}).` }
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
  const settings = await prisma.sM_Settings.findFirst({ where: { id: 'singleton' } })
  const taxRate = input.taxable ? settings?.taxRate ?? 0 : 0
  const taxCents = Math.round(subtotalCents * taxRate)
  const totalCents = subtotalCents + taxCents

  let order
  try {
    order = await prisma.$transaction(async (tx) => {
      for (const it of items) {
        const res = await tx.sM_ProductVariant.updateMany({
          where: { id: it.variantId, stockQuantity: { gte: it.quantity } },
          data: { stockQuantity: { decrement: it.quantity } },
        })
        if (res.count !== 1) throw new Error('OUT_OF_STOCK')
      }
      return tx.sM_Order.create({
        data: {
          status: 'PAID',
          fulfillment: 'PICKUP',
          customerName: input.customerName?.trim() || 'In-person sale',
          customerEmail: input.customerEmail?.trim() || 'pos@smellymellys.net',
          subtotalCents,
          shippingCents: 0,
          taxCents,
          totalCents,
          paymentMethod: 'MANUAL',
          manualPaymentNote: input.paymentNote?.trim() || 'In-person (POS)',
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
      })
    })
  } catch (err) {
    const soldOut = err instanceof Error && err.message === 'OUT_OF_STOCK'
    if (!soldOut) console.error('POS sale failed:', err)
    return {
      ok: false,
      error: soldOut ? 'An item just sold out — refresh and try again.' : 'Could not complete the sale.',
    }
  }

  // Only link a customer row when a real email was captured (skip the POS placeholder).
  if (input.customerEmail?.trim()) {
    try {
      await upsertCustomerFromOrder(order)
    } catch (e) {
      console.error(`[crm] POS upsert for ${order.id} failed:`, e)
    }
  }

  revalidatePath('/admin/pos')
  revalidatePath('/admin/orders')
  revalidatePath('/admin/inventory')
  return { ok: true, orderId: order.id, orderNumber: order.orderNumber }
}
