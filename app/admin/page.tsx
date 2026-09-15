import Link from 'next/link'
import type { SM_OrderStatus } from '@prisma/client'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import MaintenanceToggle from './MaintenanceToggle'

export const dynamic = 'force-dynamic'

const OPEN_STATUSES: SM_OrderStatus[] = ['PENDING', 'PAID', 'PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED']

// One tile per open status, in workflow order. `href` deep-links into the
// orders list pre-filtered (list understands ?status=A,B and range=all).
const OPEN_TILES: { status: SM_OrderStatus; label: string; hint: string; tone: string }[] = [
  { status: 'PENDING', label: 'Awaiting payment', hint: 'Venmo / Cash App not confirmed yet', tone: 'bg-gray-100 text-gray-700' },
  { status: 'PAID', label: 'To pack', hint: 'Paid, nothing done yet', tone: 'bg-green-100 text-green-700' },
  { status: 'PROCESSING', label: 'Packing', hint: 'Being made / boxed', tone: 'bg-green-100 text-green-700' },
  { status: 'READY_FOR_PICKUP', label: 'Ready for pickup', hint: 'Waiting on the customer', tone: 'bg-amber-100 text-amber-700' },
  { status: 'SHIPPED', label: 'In the mail', hint: 'Shipped, not marked delivered', tone: 'bg-blue-100 text-blue-700' },
]

function statusLabel(st: string): string {
  return OPEN_TILES.find((t) => t.status === st)?.label ?? st
}
function statusTone(st: string): string {
  return OPEN_TILES.find((t) => t.status === st)?.tone ?? 'bg-gray-100 text-gray-600'
}
function ageLabel(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day'
  return `${days} days`
}

export default async function AdminDashboard() {
  await requireAdmin()

  const [productCount, variantCount, orderCount, lowStock] = await Promise.all([
    prisma.sM_Product.count({ where: { isActive: true } }),
    prisma.sM_ProductVariant.count({ where: { isActive: true } }),
    prisma.sM_Order.count({
      where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    }),
    prisma.sM_ProductVariant.findMany({
      where: {
        isActive: true,
        stockQuantity: { lte: prisma.sM_ProductVariant.fields.lowStockAt },
      },
      include: {
        product: { select: { name: true } },
      },
      orderBy: { stockQuantity: 'asc' },
      take: 10,
    }),
  ])

  const settings = await prisma.sM_Settings.findFirst({
    where: { id: 'singleton' },
    select: { maintenanceMode: true, maintenanceMessage: true },
  })

  // Outstanding = anything Mel still has to act on or is still in the mail.
  // Oldest first so the ones that have been waiting longest float to the top.
  const [openCounts, outstanding] = await Promise.all([
    prisma.sM_Order.groupBy({
      by: ['status'],
      where: { status: { in: OPEN_STATUSES } },
      _count: { _all: true },
    }),
    prisma.sM_Order.findMany({
      where: { status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      select: {
      id: true,
      orderNumber: true,
      customerName: true,
      totalCents: true,
      status: true,
      fulfillment: true,
      createdAt: true,
    },
    }),
  ])
  const countFor = (st: SM_OrderStatus) =>
    openCounts.find((c) => c.status === st)?._count._all ?? 0

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark">
        Dashboard
      </h1>

      <div className="mt-6">
        <MaintenanceToggle
          initialOn={settings?.maintenanceMode ?? false}
          initialMessage={settings?.maintenanceMessage ?? ''}
        />
      </div>

      {/* Outstanding orders at a glance — one tile per open status */}
      <h2 className="mt-8 font-display text-lg font-semibold text-brand-dark">
        Outstanding Orders
        <span className="ml-2 text-sm font-normal text-brand-brown/60">
          {outstanding.length} open
        </span>
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {OPEN_TILES.map((t) => {
          const n = countFor(t.status)
          return (
            <Link
              key={t.status}
              href={`/admin/orders?status=${t.status}&range=all`}
              title={t.hint}
              className={`card text-center transition hover:shadow-md ${n > 0 ? '' : 'opacity-60'}`}
            >
              <div className="text-3xl font-bold text-brand-terra">{n}</div>
              <div className="text-sm text-brand-brown/60">{t.label}</div>
            </Link>
          )
        })}
        <Link
          href="/admin/inventory"
          className={`card text-center transition hover:shadow-md ${lowStock.length > 0 ? 'border-red-300 bg-red-50' : ''}`}
        >
          <div className={`text-3xl font-bold ${lowStock.length > 0 ? 'text-red-600' : 'text-brand-terra'}`}>
            {lowStock.length}
          </div>
          <div className="text-sm text-brand-brown/60">Low Stock</div>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-brand-dark">
              Low Stock Alerts
            </h2>
            <Link href="/admin/inventory" className="text-xs text-brand-terra hover:underline">
              View all →
            </Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-brand-brown/50">All stocked up!</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                  <span className="text-brand-dark">
                    {v.product.name} — {v.name}
                  </span>
                  <span className={`font-medium ${v.stockQuantity === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {v.stockQuantity} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Outstanding queue — every open order, oldest first */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-brand-dark">
              Open Orders
            </h2>
            <Link
              href={`/admin/orders?status=${OPEN_STATUSES.join(',')}&range=all`}
              className="text-xs text-brand-terra hover:underline"
            >
              View all →
            </Link>
          </div>
          {outstanding.length === 0 ? (
            <p className="text-sm text-brand-brown/50">All caught up — nothing outstanding.</p>
          ) : (
            <ul className="divide-y divide-brand-brown/10">
              {outstanding.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-brand-cream/40"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-brand-dark">#{o.orderNumber}</span>
                      <span className="ml-2 truncate text-brand-brown/60">{o.customerName}</span>
                      <div className="text-xs text-brand-brown/50">
                        {o.fulfillment === 'PICKUP' ? 'Pickup' : o.fulfillment === 'HOST_DELIVERY' ? 'Via host' : 'Ship'} · {ageLabel(o.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-brand-brown/60">
                        ${(o.totalCents / 100).toFixed(2)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusTone(o.status)}`}>
                        {statusLabel(o.status)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/pos" className="btn-primary">
          🛒 New Sale
        </Link>
        <Link href="/admin/products/new" className="btn-secondary">
          + Add Product
        </Link>
        <Link href="/admin/inventory" className="btn-secondary">
          Manage Inventory
        </Link>
      </div>
    </div>
  )
}
