import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function OrdersPage() {
  await requireAdmin()

  const orders = await prisma.sM_Order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      items: {
        select: { productName: true, variantName: true, quantity: true },
      },
    },
  })

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-6">
        Orders
      </h1>

      {orders.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-brand-brown/60">No orders yet.</p>
          <p className="text-sm text-brand-brown/40 mt-1">
            Orders will appear here once customers start purchasing.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-warm/60">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-warm/40 bg-white">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-medium text-brand-dark">
                    #{o.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-brand-dark">{o.customerName}</div>
                    <div className="text-xs text-brand-brown/50">{o.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-brand-brown/70">
                    {o.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.fulfillment === 'SHIP'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {o.fulfillment === 'SHIP' ? 'Ship' : 'Pickup'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-dark">
                    ${(o.totalCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      o.status === 'PAID' || o.status === 'PROCESSING'
                        ? 'bg-green-100 text-green-700'
                        : o.status === 'SHIPPED' || o.status === 'DELIVERED'
                          ? 'bg-blue-100 text-blue-700'
                          : o.status === 'READY_FOR_PICKUP' || o.status === 'PICKED_UP'
                            ? 'bg-amber-100 text-amber-700'
                            : o.status === 'CANCELLED' || o.status === 'REFUNDED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                    }`}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-brown/50">
                    {o.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
