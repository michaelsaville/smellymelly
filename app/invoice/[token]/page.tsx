import { notFound } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import { isStripeConfigured, getStripePublishableKey } from '@/app/lib/stripe'
import InvoicePayClient from './InvoicePayClient'

export const dynamic = 'force-dynamic'

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function InvoicePayPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const invoice = await prisma.sM_Invoice.findUnique({
    where: { payToken: token },
    include: { items: true },
  })
  if (!invoice) notFound()

  const isPaid = invoice.status === 'PAID'
  const isCancelled = invoice.status === 'CANCELLED'
  const canPay = !isPaid && !isCancelled && isStripeConfigured() && invoice.totalCents >= 50

  return (
    <div className="min-h-screen bg-surface-warm">
      <nav className="border-b border-brand-warm/40 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <span className="font-display text-2xl font-bold text-brand-brown">Smelly Melly</span>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h1 className="font-display text-3xl font-bold text-brand-dark">
            Invoice #{invoice.invoiceNumber}
          </h1>
          {isPaid ? (
            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Paid
            </span>
          ) : isCancelled ? (
            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              Cancelled
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              Due
            </span>
          )}
        </div>
        <p className="text-brand-brown/70 mb-8">Billed to {invoice.customerName}</p>

        <div className="card mb-6">
          <div className="space-y-3">
            {invoice.items.map((it) => (
              <div key={it.id} className="flex justify-between text-sm">
                <div className="min-w-0 flex-1 pr-3">
                  <p className="font-medium text-brand-dark">{it.description}</p>
                  {it.quantity > 1 && (
                    <p className="text-brand-brown/60 text-xs">
                      {it.quantity} × {formatMoney(it.unitCents)}
                    </p>
                  )}
                </div>
                <span className="text-brand-dark font-medium flex-shrink-0">
                  {formatMoney(it.totalCents)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-brand-warm/40 mt-4 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-brand-brown">
              <span>Subtotal</span>
              <span>{formatMoney(invoice.subtotalCents)}</span>
            </div>
            {invoice.taxCents > 0 && (
              <div className="flex justify-between text-brand-brown/60">
                <span>Tax</span>
                <span>{formatMoney(invoice.taxCents)}</span>
              </div>
            )}
            <div className="border-t border-brand-warm/40 pt-2 flex justify-between font-semibold text-brand-dark text-base">
              <span>Total</span>
              <span>{formatMoney(invoice.totalCents)}</span>
            </div>
          </div>
          {invoice.notes && (
            <p className="mt-4 border-t border-brand-warm/40 pt-3 text-sm text-brand-brown/70 whitespace-pre-wrap">
              {invoice.notes}
            </p>
          )}
        </div>

        {isPaid ? (
          <div className="card text-center text-sm text-brand-brown/70">
            This invoice was paid
            {invoice.paidAt ? ` on ${invoice.paidAt.toLocaleDateString()}` : ''}. Thank you!
          </div>
        ) : isCancelled ? (
          <div className="card text-center text-sm text-brand-brown/70">
            This invoice has been cancelled. Please contact Smelly Melly with any questions.
          </div>
        ) : canPay ? (
          <div className="card">
            <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Pay this invoice</h2>
            <InvoicePayClient
              token={token}
              amountCents={invoice.totalCents}
              publishableKey={getStripePublishableKey()}
            />
          </div>
        ) : (
          <div className="card text-center text-sm text-brand-brown/70">
            Online payment isn&apos;t available for this invoice. Please contact Smelly Melly to
            arrange payment.
          </div>
        )}
      </div>
    </div>
  )
}
