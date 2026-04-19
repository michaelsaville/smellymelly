import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import CustomerEditor from './CustomerEditor'

export const dynamic = 'force-dynamic'

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PAID: 'bg-green-100 text-green-700',
  PROCESSING: 'bg-green-100 text-green-700',
  SHIPPED: 'bg-blue-100 text-blue-700',
  READY_FOR_PICKUP: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-red-100 text-red-700',
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const customer = await prisma.sM_Customer.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      orders: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          fulfillment: true,
          totalCents: true,
          createdAt: true,
        },
      },
    },
  })

  if (!customer) redirect('/admin/customers')

  const allTags = await prisma.sM_Tag.findMany({ orderBy: { name: 'asc' } })
  const appliedTagIds = new Set(customer.tags.map((t) => t.tagId))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href="/admin/customers"
            className="text-xs text-brand-brown/60 hover:text-brand-terra"
          >
            &larr; Back to Customers
          </Link>
          <h1 className="font-display text-3xl font-bold text-brand-dark mt-1">
            {customer.name}
          </h1>
          <p className="text-sm text-brand-brown/60 mt-0.5">
            <a
              href={`mailto:${customer.email}`}
              className="hover:text-brand-terra"
            >
              {customer.email}
            </a>
            {customer.phone && ` · ${customer.phone}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — stats + order history */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="text-xs text-brand-brown/50 uppercase tracking-wider">
                Orders
              </div>
              <div className="font-display text-2xl font-bold text-brand-dark mt-1">
                {customer.orderCount}
              </div>
            </div>
            <div className="card text-center">
              <div className="text-xs text-brand-brown/50 uppercase tracking-wider">
                Lifetime spend
              </div>
              <div className="font-display text-2xl font-bold text-brand-dark mt-1">
                {money(customer.totalSpentCents)}
              </div>
            </div>
            <div className="card text-center">
              <div className="text-xs text-brand-brown/50 uppercase tracking-wider">
                Since
              </div>
              <div className="font-display text-lg font-bold text-brand-dark mt-1">
                {customer.firstOrderAt
                  ? customer.firstOrderAt.toLocaleDateString()
                  : '—'}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">
              Order history
            </h2>
            {customer.orders.length === 0 ? (
              <p className="text-sm text-brand-brown/60">No orders on file.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
                  <tr>
                    <th className="pb-2">#</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-warm/40">
                  {customer.orders.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-medium text-brand-dark hover:text-brand-terra"
                        >
                          #{String(o.orderNumber).padStart(4, '0')}
                        </Link>
                      </td>
                      <td className="py-2 text-xs text-brand-brown/60">
                        {o.createdAt.toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            o.fulfillment === 'SHIP'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {o.fulfillment === 'SHIP' ? 'Ship' : 'Pickup'}
                        </span>
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[o.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {o.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {money(o.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right — tags, notes, ship-to */}
        <div className="space-y-6">
          <CustomerEditor
            customerId={customer.id}
            initialNotes={customer.notes}
            allTags={allTags}
            appliedTagIds={Array.from(appliedTagIds)}
          />

          {customer.lastShipAddress && (
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
                Last ship-to
              </h2>
              <div className="text-sm text-brand-brown/80 leading-relaxed">
                {customer.lastShipName}
                <br />
                {customer.lastShipAddress}
                <br />
                {customer.lastShipCity}, {customer.lastShipState}{' '}
                {customer.lastShipZip}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
