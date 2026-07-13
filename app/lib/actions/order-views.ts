'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { SM_OrderStatus } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'
import { sendShippingNotification } from '@/app/lib/email'
import { recomputeCustomerStats } from '@/app/lib/customers'
import { SYSTEM_VIEWS, type OrderFilters } from '@/app/lib/order-views'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

export type OrderViewRow = {
  id: string
  name: string
  icon: string | null
  filters: OrderFilters
  isSystem: boolean
  displayOrder: number
}

// Idempotently create the seeded system views (once). Safe to call on every
// page load — matches by name where isSystem, inserts only what's missing.
async function ensureSystemViews(): Promise<void> {
  const existing = await prisma.sM_OrderView.findMany({
    where: { isSystem: true },
    select: { name: true },
  })
  const have = new Set(existing.map((v) => v.name))
  const missing = SYSTEM_VIEWS.filter((v) => !have.has(v.name))
  if (missing.length === 0) return
  await prisma.sM_OrderView.createMany({
    data: missing.map((v) => ({
      name: v.name,
      icon: v.icon,
      filters: v.filters as object,
      isSystem: true,
      displayOrder: v.displayOrder,
    })),
  })
}

export async function getOrderViews(): Promise<OrderViewRow[]> {
  await requireAdmin()
  await ensureSystemViews()
  const views = await prisma.sM_OrderView.findMany({
    orderBy: [{ isSystem: 'desc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return views.map((v) => ({
    id: v.id,
    name: v.name,
    icon: v.icon,
    filters: (v.filters as OrderFilters) ?? {},
    isSystem: v.isSystem,
    displayOrder: v.displayOrder,
  }))
}

export async function createOrderView(input: {
  name: string
  filters: OrderFilters
  icon?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin()
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'A view name is required.' }

  const max = await prisma.sM_OrderView.aggregate({ _max: { displayOrder: true } })
  const view = await prisma.sM_OrderView.create({
    data: {
      name,
      icon: input.icon?.trim() || '⭐',
      filters: input.filters as object,
      isSystem: false,
      displayOrder: (max._max.displayOrder ?? 100) + 10,
    },
  })
  revalidatePath('/admin/orders')
  return { ok: true, id: view.id }
}

export async function updateOrderView(
  id: string,
  data: { name?: string; filters?: OrderFilters; icon?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  const view = await prisma.sM_OrderView.findUnique({ where: { id }, select: { isSystem: true } })
  if (!view) return { ok: false, error: 'View not found.' }
  if (view.isSystem) return { ok: false, error: 'Built-in views can’t be edited.' }
  await prisma.sM_OrderView.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() || undefined }),
      ...(data.filters !== undefined && { filters: data.filters as object }),
      ...(data.icon !== undefined && { icon: data.icon.trim() || null }),
    },
  })
  revalidatePath('/admin/orders')
  return { ok: true }
}

export async function deleteOrderView(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin()
  const view = await prisma.sM_OrderView.findUnique({ where: { id }, select: { isSystem: true } })
  if (!view) return { ok: false, error: 'View not found.' }
  if (view.isSystem) return { ok: false, error: 'Built-in views can’t be deleted.' }
  await prisma.sM_OrderView.delete({ where: { id } })
  revalidatePath('/admin/orders')
  return { ok: true }
}

// ── Inline + bulk status change ──────────────────────────────────────────
// Mirrors the side effects of PATCH /api/admin/orders/[id]: sets shippedAt /
// cancelledAt / paidAt on the relevant transitions, fires the shipping email
// when an order with tracking flips to SHIPPED, and refreshes CRM stats.

const VALID_STATUSES: SM_OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'PICKED_UP',
  'CANCELLED',
  'REFUNDED',
]

export async function setOrdersStatus(
  ids: string[],
  status: SM_OrderStatus,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requireAdmin()
  if (!ids.length) return { ok: false, error: 'No orders selected.' }
  if (!VALID_STATUSES.includes(status)) return { ok: false, error: 'Invalid status.' }

  const orders = await prisma.sM_Order.findMany({
    where: { id: { in: ids } },
    include: { items: true },
  })

  let count = 0
  for (const order of orders) {
    if (order.status === status) continue
    const data: {
      status: SM_OrderStatus
      shippedAt?: Date
      cancelledAt?: Date
      paidAt?: Date
    } = { status }
    if (status === 'SHIPPED' && !order.shippedAt) data.shippedAt = new Date()
    if (status === 'CANCELLED' && !order.cancelledAt) data.cancelledAt = new Date()
    // Any "paid or beyond" status should stamp paidAt if it isn't already set
    // (covers marking a manual/pending order paid in bulk).
    if (!order.paidAt && status !== 'PENDING' && status !== 'CANCELLED') {
      data.paidAt = new Date()
    }

    const updated = await prisma.sM_Order.update({
      where: { id: order.id },
      data,
      include: { items: true },
    })
    count++

    if (status === 'SHIPPED' && order.status !== 'SHIPPED' && updated.trackingNumber) {
      sendShippingNotification(updated).catch((err) =>
        console.error(`[email] bulk ship-notif for ${updated.id} failed:`, err),
      )
    }
    if (updated.customerId) {
      recomputeCustomerStats(updated.customerId).catch((err) =>
        console.error(`[crm] bulk recompute for ${updated.customerId} failed:`, err),
      )
    }
  }

  revalidatePath('/admin/orders')
  return { ok: true, count }
}
