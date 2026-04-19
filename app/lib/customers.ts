import { prisma } from './prisma'
import type { SM_Order } from '@prisma/client'

// PAID-or-later statuses count toward totals; CANCELLED/REFUNDED don't.
// PENDING is excluded too — only counts once the charge actually clears.
const COUNTED_STATUSES = [
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'PICKED_UP',
] as const

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Upsert a customer row from an order and link the order to it.
 * Safe to call multiple times — idempotent by lowercased email.
 * Recomputes denormalized stats so the caller doesn't have to.
 */
export async function upsertCustomerFromOrder(order: SM_Order): Promise<void> {
  const email = normalizeEmail(order.customerEmail)
  if (!email) return

  const customer = await prisma.sM_Customer.upsert({
    where: { email },
    create: {
      email,
      name: order.customerName,
      phone: order.customerPhone,
    },
    update: {
      // Refresh name/phone from the most recent order so the profile shows
      // their latest info without overwriting admin-edited notes.
      name: order.customerName,
      phone: order.customerPhone ?? undefined,
    },
  })

  await prisma.sM_Order.update({
    where: { id: order.id },
    data: { customerId: customer.id },
  })

  await recomputeCustomerStats(customer.id)
}

/**
 * Recompute denormalized stats from the underlying orders. Call after any
 * change that could shift counted-status totals (checkout, cancel, refund,
 * backfill).
 */
export async function recomputeCustomerStats(customerId: string): Promise<void> {
  const countedOrders = await prisma.sM_Order.findMany({
    where: {
      customerId,
      status: { in: [...COUNTED_STATUSES] },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      totalCents: true,
      createdAt: true,
      fulfillment: true,
      shippingName: true,
      shippingAddress: true,
      shippingCity: true,
      shippingState: true,
      shippingZip: true,
    },
  })

  const orderCount = countedOrders.length
  const totalSpentCents = countedOrders.reduce((sum, o) => sum + o.totalCents, 0)
  const firstOrderAt = countedOrders[0]?.createdAt ?? null
  const lastOrderAt = countedOrders[orderCount - 1]?.createdAt ?? null

  // Last SHIP order wins for the default ship-to snapshot.
  const lastShip = [...countedOrders]
    .reverse()
    .find((o) => o.fulfillment === 'SHIP' && o.shippingAddress)

  await prisma.sM_Customer.update({
    where: { id: customerId },
    data: {
      orderCount,
      totalSpentCents,
      firstOrderAt,
      lastOrderAt,
      lastShipName: lastShip?.shippingName ?? null,
      lastShipAddress: lastShip?.shippingAddress ?? null,
      lastShipCity: lastShip?.shippingCity ?? null,
      lastShipState: lastShip?.shippingState ?? null,
      lastShipZip: lastShip?.shippingZip ?? null,
    },
  })
}

/**
 * Recompute for a given email, resolving to the customer row if it exists.
 * Useful when a status change comes in before we have the customer ID handy.
 */
export async function recomputeCustomerStatsByEmail(email: string): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!normalized) return
  const customer = await prisma.sM_Customer.findUnique({
    where: { email: normalized },
    select: { id: true },
  })
  if (!customer) return
  await recomputeCustomerStats(customer.id)
}
