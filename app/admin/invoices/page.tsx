import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default async function InvoicesPage() {
  await requireAdmin()
  const invoices = await prisma.sM_Invoice.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display text-3xl font-bold text-brand-dark">Invoices</h1>
        <Link href="/admin/invoices/new" className="btn-primary text-sm">+ New invoice</Link>
      </div>

      {invoices.length === 0 ? (
        <div className="card text-center py-12 text-brand-brown/60">
          No invoices yet. Create one for a custom or wholesale order.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-warm/60">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-warm/40 bg-white">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-medium text-brand-dark">
                    <Link href={`/admin/invoices/${inv.id}`} className="hover:text-brand-terra">
                      #{inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{inv.customerName}</td>
                  <td className="px-4 py-3 font-medium tabular-nums">{money(inv.totalCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[inv.status] ?? ''}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-brown/50">
                    {inv.createdAt.toLocaleDateString()}
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
