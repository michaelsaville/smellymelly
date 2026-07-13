'use client'

import { useState, type FormEvent } from 'react'
import StoreLayout from '@/app/components/StoreLayout'

type TrackedOrder = {
  orderNumber: number
  status: string
  fulfillment: 'SHIP' | 'PICKUP' | 'HOST_DELIVERY'
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  trackingNumber: string | null
  totalCents: number
  customerName: string
  items: { productName: string; variantName: string; quantity: number }[]
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_COPY: Record<string, string> = {
  PENDING: 'We’ve received your order and are awaiting payment.',
  PAID: 'Payment received — your order is in the queue!',
  PROCESSING: 'Mel is handcrafting your order right now.',
  SHIPPED: 'Your order is on its way!',
  READY_FOR_PICKUP: 'Your order is ready for pickup.',
  DELIVERED: 'Delivered — enjoy!',
  PICKED_UP: 'Picked up — enjoy!',
  CANCELLED: 'This order was cancelled. Reach out if that’s a surprise.',
  REFUNDED: 'This order was refunded.',
}

// Ordered milestones for the little progress tracker.
function steps(fulfillment: string): { key: string; label: string }[] {
  const start = [
    { key: 'PAID', label: 'Confirmed' },
    { key: 'PROCESSING', label: 'Making' },
  ]
  if (fulfillment === 'SHIP') {
    return [...start, { key: 'SHIPPED', label: 'Shipped' }, { key: 'DELIVERED', label: 'Delivered' }]
  }
  return [...start, { key: 'READY_FOR_PICKUP', label: 'Ready' }, { key: 'PICKED_UP', label: 'Picked up' }]
}

// How far along a given status is (index into steps()).
function reachedIndex(status: string, fulfillment: string): number {
  const order = ['PENDING', 'PAID', 'PROCESSING']
  order.push(...(fulfillment === 'SHIP' ? ['SHIPPED', 'DELIVERED'] : ['READY_FOR_PICKUP', 'PICKED_UP']))
  const idx = order.indexOf(status)
  // Map onto the steps() array (which starts at PAID = index 0).
  return idx - 1
}

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [notFound, setNotFound] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setOrder(null)
    setNotFound(false)
    setLoading(true)
    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      if (!data.found) setNotFound(true)
      else setOrder(data.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const isTerminalBad = order && (order.status === 'CANCELLED' || order.status === 'REFUNDED')

  return (
    <StoreLayout>
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">Track your order</h1>
        <p className="text-brand-brown/70 mb-6 text-sm">
          Enter your order number and the email you used at checkout.
        </p>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">Order number</label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="e.g. 1024"
              inputMode="numeric"
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="input w-full"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Looking…' : 'Track order'}
          </button>
        </form>

        {notFound && (
          <div className="card mt-6 text-center">
            <p className="text-brand-brown">
              We couldn’t find an order with that number and email. Double-check both, or{' '}
              <a href="/contact" className="text-brand-terra hover:underline">contact us</a>.
            </p>
          </div>
        )}

        {order && (
          <div className="card mt-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display text-xl font-bold text-brand-dark">Order #{order.orderNumber}</h2>
              <span className="text-sm text-brand-brown/60">{money(order.totalCents)}</span>
            </div>
            <p className="text-sm text-brand-brown/80 mb-5">
              {STATUS_COPY[order.status] ?? order.status.replace(/_/g, ' ')}
            </p>

            {/* Progress tracker (hidden for cancelled/refunded) */}
            {!isTerminalBad && (
              <div className="flex items-center mb-6">
                {steps(order.fulfillment).map((step, i) => {
                  const reached = i <= reachedIndex(order.status, order.fulfillment)
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center relative">
                      {i > 0 && (
                        <span
                          className={`absolute top-2.5 right-1/2 w-full h-0.5 ${
                            i <= reachedIndex(order.status, order.fulfillment) ? 'bg-brand-terra' : 'bg-brand-warm/50'
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 h-5 w-5 rounded-full border-2 ${
                          reached ? 'bg-brand-terra border-brand-terra' : 'bg-white border-brand-warm'
                        }`}
                      />
                      <span className={`mt-1.5 text-[11px] ${reached ? 'text-brand-dark font-medium' : 'text-brand-brown/50'}`}>
                        {step.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tracking number */}
            {order.trackingNumber && (
              <div className="rounded-lg border border-brand-warm/60 p-3 mb-4">
                <div className="text-xs text-brand-brown/60 mb-0.5">Tracking number</div>
                <a
                  href={`https://parcelsapp.com/en/tracking/${encodeURIComponent(order.trackingNumber)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-brand-terra hover:underline break-all"
                >
                  {order.trackingNumber}
                </a>
              </div>
            )}

            {/* Items */}
            <div className="space-y-2 border-t border-brand-warm/40 pt-4">
              {order.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-brand-brown">
                    {it.quantity}× {it.productName}
                    <span className="text-brand-brown/50"> · {it.variantName}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  )
}
