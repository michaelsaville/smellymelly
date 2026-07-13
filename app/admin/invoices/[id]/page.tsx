import { redirect } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { ensureInvoicePayToken } from '@/app/lib/actions/invoices'
import InvoiceActions from './InvoiceActions'
import PayLinkBar from './PayLinkBar'

export const dynamic = 'force-dynamic'

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [invoice, settings] = await Promise.all([
    prisma.sM_Invoice.findUnique({ where: { id }, include: { items: true } }),
    prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: {
        businessName: true,
        businessEmail: true,
        businessPhone: true,
        address: true,
        city: true,
        state: true,
        zip: true,
      },
    }),
  ])
  if (!invoice) redirect('/admin/invoices')

  // Backfill a pay token for invoices created before this feature existed.
  const payToken = invoice.payToken ?? (await ensureInvoicePayToken(invoice.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-4 print:hidden">
        <a href="/admin/invoices" className="text-xs text-brand-brown/60 hover:text-brand-terra">
          &larr; Invoices
        </a>
        <span className="rounded-full bg-brand-warm/40 px-3 py-1 text-xs font-medium text-brand-brown">
          {invoice.status}
        </span>
      </div>

      <div className="mb-5">
        <InvoiceActions id={invoice.id} status={invoice.status} />
      </div>

      {payToken && invoice.status !== 'CANCELLED' && (
        <div className="mb-5 max-w-2xl mx-auto">
          <PayLinkBar token={payToken} />
        </div>
      )}

      {/* Printable invoice */}
      <div className="card max-w-2xl mx-auto print:shadow-none print:border-0">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-bold text-brand-dark">
              {settings?.businessName ?? 'Smelly Melly'}
            </h1>
            <div className="text-sm text-brand-brown/70 mt-1">
              {settings?.businessEmail && <div>{settings.businessEmail}</div>}
              {settings?.businessPhone && <div>{settings.businessPhone}</div>}
              {settings?.address && (
                <div>
                  {settings.address}, {settings.city} {settings.state} {settings.zip}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold text-brand-terra">INVOICE</div>
            <div className="text-sm text-brand-brown/70 mt-1">#{invoice.invoiceNumber}</div>
            <div className="text-xs text-brand-brown/50">{invoice.createdAt.toLocaleDateString()}</div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-xs uppercase tracking-wide text-brand-brown/50">Bill to</div>
          <div className="font-medium text-brand-dark">{invoice.customerName}</div>
          {invoice.customerEmail && <div className="text-sm text-brand-brown/70">{invoice.customerEmail}</div>}
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-brand-warm/50 text-left text-xs uppercase tracking-wide text-brand-brown/50">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it) => (
              <tr key={it.id} className="border-b border-brand-warm/20">
                <td className="py-2 text-brand-dark">{it.description}</td>
                <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                <td className="py-2 text-right tabular-nums">{money(it.unitCents)}</td>
                <td className="py-2 text-right tabular-nums">{money(it.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-[220px] space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-brand-brown/70">Subtotal</span><span className="tabular-nums">{money(invoice.subtotalCents)}</span></div>
          <div className="flex justify-between"><span className="text-brand-brown/70">Tax</span><span className="tabular-nums">{money(invoice.taxCents)}</span></div>
          <div className="flex justify-between border-t border-brand-warm/40 pt-1 font-semibold text-brand-dark text-base">
            <span>Total</span><span className="tabular-nums">{money(invoice.totalCents)}</span>
          </div>
          {invoice.paidAt && (
            <div className="text-right text-xs text-green-700 pt-1">
              Paid {invoice.paidAt.toLocaleDateString()}
            </div>
          )}
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-4 border-t border-brand-warm/40 text-sm text-brand-brown/70 whitespace-pre-wrap">
            {invoice.notes}
          </div>
        )}
      </div>
    </div>
  )
}
