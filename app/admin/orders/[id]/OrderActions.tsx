'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Status =
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED'
  | 'PICKED_UP'
  | 'CANCELLED'
  | 'REFUNDED'

interface Props {
  orderId: string
  status: Status
  fulfillment: 'SHIP' | 'PICKUP'
  trackingNumber: string | null
  shippingLabel: string | null
  canBuyLabel: boolean
}

// Which status "forward" buttons to show given the current state.
function nextSteps(status: Status, fulfillment: 'SHIP' | 'PICKUP'): Status[] {
  if (status === 'PAID') return ['PROCESSING']
  if (status === 'PROCESSING') {
    return fulfillment === 'SHIP' ? ['SHIPPED'] : ['READY_FOR_PICKUP']
  }
  if (status === 'SHIPPED') return ['DELIVERED']
  if (status === 'READY_FOR_PICKUP') return ['PICKED_UP']
  return []
}

const LABELS: Record<Status, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  PROCESSING: 'Mark as Processing',
  SHIPPED: 'Mark as Shipped',
  READY_FOR_PICKUP: 'Ready for Pickup',
  DELIVERED: 'Mark Delivered',
  PICKED_UP: 'Mark Picked Up',
  CANCELLED: 'Cancel Order',
  REFUNDED: 'Refunded',
}

export default function OrderActions({
  orderId,
  status,
  fulfillment,
  trackingNumber,
  canBuyLabel,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualTracking, setManualTracking] = useState(trackingNumber ?? '')

  async function patch(body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function buyLabel() {
    setBusy('label')
    setError(null)
    try {
      const res = await fetch('/api/shipping/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Label purchase failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(null)
    }
  }

  async function manualShip() {
    const tracking = manualTracking.trim()
    if (!tracking) {
      setError('Enter a tracking number first.')
      return
    }
    await patch({ status: 'SHIPPED', trackingNumber: tracking }, 'manual-ship')
  }

  const nexts = nextSteps(status, fulfillment)
  const terminal = ['DELIVERED', 'PICKED_UP', 'CANCELLED', 'REFUNDED'].includes(status)

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">
        Actions
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {terminal ? (
        <p className="text-sm text-brand-brown/60">
          This order is closed ({status.replace(/_/g, ' ').toLowerCase()}).
        </p>
      ) : (
        <div className="space-y-4">
          {/* Advance status buttons */}
          {nexts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nexts.map((next) => (
                <button
                  key={next}
                  onClick={() => patch({ status: next }, `next-${next}`)}
                  disabled={busy !== null}
                  className="btn-primary disabled:opacity-60"
                >
                  {busy === `next-${next}` ? 'Working…' : LABELS[next]}
                </button>
              ))}
            </div>
          )}

          {/* Shipping actions — ship orders only, once processing/paid */}
          {fulfillment === 'SHIP' && !trackingNumber && (status === 'PAID' || status === 'PROCESSING') && (
            <div className="rounded-lg border border-brand-warm/60 p-4 space-y-3">
              <h3 className="font-medium text-sm text-brand-dark">Shipping</h3>

              {canBuyLabel && (
                <button
                  onClick={buyLabel}
                  disabled={busy !== null}
                  className="btn-secondary disabled:opacity-60"
                >
                  {busy === 'label' ? 'Buying label…' : 'Buy USPS Label (EasyPost)'}
                </button>
              )}

              <div>
                <label className="block text-xs text-brand-brown/60 mb-1">
                  Or enter tracking number manually
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualTracking}
                    onChange={(e) => setManualTracking(e.target.value)}
                    placeholder="1Z..."
                    className="input flex-1"
                  />
                  <button
                    onClick={manualShip}
                    disabled={busy !== null}
                    className="btn-secondary disabled:opacity-60"
                  >
                    {busy === 'manual-ship' ? 'Saving…' : 'Mark Shipped'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-brand-brown/50">
                  Marking shipped emails the customer a tracking notification.
                </p>
              </div>
            </div>
          )}

          {/* Cancel — available until shipped/delivered/picked_up */}
          {(status === 'PENDING' || status === 'PAID' || status === 'PROCESSING' || status === 'READY_FOR_PICKUP') && (
            <div className="pt-3 border-t border-brand-warm/40">
              <button
                onClick={() => {
                  if (confirm('Cancel this order? Stock will not be restored automatically.')) {
                    patch({ status: 'CANCELLED' }, 'cancel')
                  }
                }}
                disabled={busy !== null}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60"
              >
                {busy === 'cancel' ? 'Cancelling…' : 'Cancel Order'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
