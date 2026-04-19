import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [order, settings] = await Promise.all([
    prisma.sM_Order.findUnique({ where: { id }, include: { items: true } }),
    prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: {
        venmoHandle: true,
        cashAppTag: true,
        paymentInstructions: true,
      },
    }),
  ])

  if (!order) {
    notFound()
  }

  const isManual = order.paymentMethod === 'MANUAL'
  const orderNum = String(order.orderNumber).padStart(4, '0')

  return (
    <div className="min-h-screen bg-surface-warm">
      {/* Minimal nav */}
      <nav className="border-b border-brand-warm/40 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <Link href="/" className="font-display text-2xl font-bold text-brand-brown">
            Smelly Melly
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-6 py-16">
        {/* Thank you */}
        <div className="text-center mb-10">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-terra/10 mb-4">
            <svg className="h-8 w-8 text-brand-terra" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-brand-dark">Thank You!</h1>
          <p className="mt-2 text-brand-brown/70">
            Your order has been placed successfully.
          </p>
          <p className="mt-1 text-sm text-brand-brown/50">
            Order #{order.orderNumber}
          </p>
        </div>

        {/* Order details */}
        <div className="card mb-6">
          <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Order Details</h2>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium text-brand-dark">{item.productName}</p>
                  <p className="text-brand-brown/60 text-xs">{item.variantName} x {item.quantity}</p>
                </div>
                <span className="font-medium text-brand-dark">{formatMoney(item.totalCents)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-brand-warm/40 mt-4 pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-brand-brown">
              <span>Subtotal</span>
              <span>{formatMoney(order.subtotalCents)}</span>
            </div>
            {order.shippingCents > 0 && (
              <div className="flex justify-between text-brand-brown">
                <span>Shipping</span>
                <span>{formatMoney(order.shippingCents)}</span>
              </div>
            )}
            <div className="flex justify-between text-brand-brown/60">
              <span>Tax</span>
              <span>{formatMoney(order.taxCents)}</span>
            </div>
            <div className="border-t border-brand-warm/40 pt-2 flex justify-between font-semibold text-brand-dark text-base">
              <span>Total</span>
              <span>{formatMoney(order.totalCents)}</span>
            </div>
          </div>
        </div>

        {/* Customer info */}
        <div className="card mb-6">
          <h2 className="font-display text-lg font-bold text-brand-dark mb-3">Customer</h2>
          <p className="text-sm text-brand-brown">{order.customerName}</p>
          <p className="text-sm text-brand-brown/70">{order.customerEmail}</p>
          {order.customerPhone && (
            <p className="text-sm text-brand-brown/70">{order.customerPhone}</p>
          )}
        </div>

        {/* Payment instructions for manual orders */}
        {isManual && (
          <div className="card mb-6 border-amber-300 bg-amber-50">
            <h2 className="font-display text-lg font-bold text-brand-dark mb-3">
              How to pay
            </h2>
            <p className="text-sm text-brand-brown mb-3">
              Your order is <strong>pending payment</strong>. Please send{' '}
              <strong>{formatMoney(order.totalCents)}</strong> using one of the
              options below, with <strong>#{orderNum}</strong> in the memo so
              Mel can match it up.
            </p>
            <ul className="text-sm space-y-2">
              {settings?.venmoHandle && (
                <li className="flex items-center gap-2">
                  <span className="font-medium text-brand-dark">Venmo:</span>
                  <span className="font-mono text-brand-terra">{settings.venmoHandle}</span>
                </li>
              )}
              {settings?.cashAppTag && (
                <li className="flex items-center gap-2">
                  <span className="font-medium text-brand-dark">Cash App:</span>
                  <span className="font-mono text-brand-terra">{settings.cashAppTag}</span>
                </li>
              )}
            </ul>
            {settings?.paymentInstructions && (
              <p className="text-sm text-brand-brown/80 mt-3 pt-3 border-t border-amber-300/50 whitespace-pre-wrap">
                {settings.paymentInstructions}
              </p>
            )}
            {!settings?.venmoHandle && !settings?.cashAppTag && (
              <p className="text-sm text-brand-brown/80">
                Mel will email you at <strong>{order.customerEmail}</strong>{' '}
                with payment details shortly.
              </p>
            )}
          </div>
        )}

        {/* Fulfillment info */}
        <div className="card mb-8">
          <h2 className="font-display text-lg font-bold text-brand-dark mb-3">
            {order.fulfillment === 'SHIP' ? 'Shipping' : 'Pickup'}
          </h2>
          {order.fulfillment === 'SHIP' ? (
            <div>
              <div className="text-sm text-brand-brown space-y-0.5">
                <p>{order.shippingName}</p>
                <p>{order.shippingAddress}</p>
                <p>{order.shippingCity}, {order.shippingState} {order.shippingZip}</p>
              </div>
              <p className="mt-3 text-sm text-brand-brown/60">
                Tracking information will be emailed to you once your order ships.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-brand-brown">
                Smelly Melly Workshop, West Virginia
              </p>
              <p className="mt-2 text-sm text-brand-brown/60">
                We will contact you at {order.customerEmail} when your order is ready for pickup.
              </p>
            </div>
          )}
        </div>

        {/* Continue shopping */}
        <div className="text-center">
          <Link href="/shop" className="btn-primary">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
