import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

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

  const recentOrders = await prisma.sM_Order.findMany({
    where: { status: { notIn: ['CANCELLED'] } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      totalCents: true,
      status: true,
      fulfillment: true,
      createdAt: true,
    },
  })

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark">
        Dashboard
      </h1>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card text-center">
          <div className="text-3xl font-bold text-brand-terra">{productCount}</div>
          <div className="text-sm text-brand-brown/60">Products</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-brand-terra">{variantCount}</div>
          <div className="text-sm text-brand-brown/60">Variants</div>
        </div>
        <div className="card text-center">
          <div className="text-3xl font-bold text-brand-terra">{orderCount}</div>
          <div className="text-sm text-brand-brown/60">Orders</div>
        </div>
        <div className={`card text-center ${lowStock.length > 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <div className={`text-3xl font-bold ${lowStock.length > 0 ? 'text-red-600' : 'text-brand-terra'}`}>
            {lowStock.length}
          </div>
          <div className="text-sm text-brand-brown/60">Low Stock</div>
        </div>
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

        {/* Recent Orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-brand-dark">
              Recent Orders
            </h2>
            <Link href="/admin/orders" className="text-xs text-brand-terra hover:underline">
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-brand-brown/50">No orders yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-brand-dark">#{o.orderNumber}</span>
                    <span className="ml-2 text-brand-brown/60">{o.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-brand-brown/60">
                      ${(o.totalCents / 100).toFixed(2)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === 'PAID' || o.status === 'PROCESSING'
                        ? 'bg-green-100 text-green-700'
                        : o.status === 'SHIPPED' || o.status === 'READY_FOR_PICKUP'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 flex gap-3">
        <Link href="/admin/products/new" className="btn-primary">
          + Add Product
        </Link>
        <Link href="/admin/inventory" className="btn-secondary">
          Manage Inventory
        </Link>
      </div>
    </div>
  )
}
