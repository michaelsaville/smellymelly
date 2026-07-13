import type { Prisma, SM_OrderStatus } from '@prisma/client'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import {
  parseFilters,
  buildWhere,
  describeRange,
  REVENUE_STATUSES,
} from '@/app/lib/order-views'
import { getOrderViews } from '@/app/lib/actions/order-views'
import OrdersClient from './OrdersClient'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const get = (k: string): string | null => {
    const v = sp[k]
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  }

  const filters = parseFilters(get)
  const page = Math.max(1, parseInt(get('page') ?? '1', 10) || 1)
  const where = buildWhere(filters) as Prisma.SM_OrderWhereInput
  const revenueWhere: Prisma.SM_OrderWhereInput = {
    AND: [where, { status: { in: REVENUE_STATUSES as SM_OrderStatus[] } }],
  }
  const unpaidWhere: Prisma.SM_OrderWhereInput = { AND: [where, { status: 'PENDING' }] }

  const [orders, totalCount, revenue, unpaid, views] = await Promise.all([
    prisma.sM_Order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        items: { select: { productName: true, variantName: true, quantity: true } },
      },
    }),
    prisma.sM_Order.count({ where }),
    prisma.sM_Order.aggregate({
      where: revenueWhere,
      _sum: { totalCents: true, subtotalCents: true, taxCents: true, shippingCents: true },
      _count: { _all: true },
    }),
    prisma.sM_Order.aggregate({
      where: unpaidWhere,
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    getOrderViews(),
  ])

  const summary = {
    rangeLabel: describeRange(filters),
    orderCount: totalCount,
    paidCount: revenue._count._all,
    grossCents: revenue._sum.totalCents ?? 0,
    subtotalCents: revenue._sum.subtotalCents ?? 0,
    taxCents: revenue._sum.taxCents ?? 0,
    shippingCents: revenue._sum.shippingCents ?? 0,
    unpaidCount: unpaid._count._all,
    unpaidCents: unpaid._sum.totalCents ?? 0,
  }

  const rows = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    items: o.items,
    fulfillment: o.fulfillment,
    status: o.status,
    paymentMethod: o.paymentMethod,
    totalCents: o.totalCents,
    campaignId: o.campaignId,
    createdAt: o.createdAt.toISOString(),
  }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display text-3xl font-bold text-brand-dark">Orders</h1>
      </div>

      {/* Filter-aware daily summary */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wider text-brand-brown/60">
            Showing: {summary.rangeLabel}
          </span>
          {summary.unpaidCount > 0 && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-medium">
              {summary.unpaidCount} awaiting payment · {money(summary.unpaidCents)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Orders', value: String(summary.orderCount), accent: false },
            { label: 'Gross (paid)', value: money(summary.grossCents), accent: true },
            { label: 'Subtotal', value: money(summary.subtotalCents), accent: false },
            { label: 'Tax', value: money(summary.taxCents), accent: false },
            { label: 'Shipping', value: money(summary.shippingCents), accent: false },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg bg-surface-muted/60 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-brand-brown/60">
                {tile.label}
              </div>
              <div
                className={`font-display text-2xl tabular-nums ${
                  tile.accent ? 'text-brand-terra' : 'text-brand-dark'
                }`}
              >
                {tile.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <OrdersClient
        rows={rows}
        views={views}
        filters={filters}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
      />
    </div>
  )
}
