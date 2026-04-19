'use client'

import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StoreLayout from '@/app/components/StoreLayout'
import SquarePaymentForm from '@/app/components/SquarePaymentForm'
import SquareCashAppPay from '@/app/components/SquareCashAppPay'
import { getCart, clearCart, type CartItem } from '@/app/lib/cart'

const TAX_RATE = 0.06
const FALLBACK_SHIPPING_CENTS = 599

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

type Fulfillment = 'SHIP' | 'PICKUP'

interface ShippingRate {
  id: string
  carrier: string
  service: string
  rateCents: number
  deliveryDays: number | null
}

export default function CheckoutPage() {
  const router = useRouter()
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fulfillment, setFulfillment] = useState<Fulfillment>('SHIP')
  const [shipName, setShipName] = useState('')
  const [shipAddress, setShipAddress] = useState('')
  const [shipCity, setShipCity] = useState('')
  const [shipState, setShipState] = useState('')
  const [shipZip, setShipZip] = useState('')

  // Shipping rates
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([])
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null)
  const [fetchingRates, setFetchingRates] = useState(false)

  // Payment state
  type PaymentMethod = 'SQUARE_CARD' | 'SQUARE_CASH_APP' | 'MANUAL'
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('SQUARE_CARD')
  const [paymentToken, setPaymentToken] = useState<string | null>(null)
  const [squareConfigured, setSquareConfigured] = useState(false)
  const [manualHandles, setManualHandles] = useState<{
    venmoHandle: string
    cashAppTag: string
    paymentInstructions: string
  } | null>(null)
  const tokenResolveRef = useRef<((token: string | null) => void) | null>(null)

  const refresh = useCallback(() => setItems(getCart()), [])

  useEffect(() => {
    setMounted(true)
    refresh()
    fetch('/api/square/config')
      .then((r) => r.json())
      .then((cfg) => {
        setSquareConfigured(cfg.configured)
        if (!cfg.configured) setPaymentMethod('MANUAL')
      })
      .catch(() => {})
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((s) => setManualHandles(s))
      .catch(() => {})
  }, [refresh])

  // Fetch shipping rates when address is complete
  const fetchShippingRates = useCallback(async () => {
    if (!shipAddress || !shipCity || !shipState || !shipZip || items.length === 0) return

    setFetchingRates(true)
    try {
      const res = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddress: { street1: shipAddress, city: shipCity, state: shipState, zip: shipZip },
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      })
      const data = await res.json()
      if (data.rates?.length) {
        setShippingRates(data.rates)
        // Auto-select cheapest rate
        if (!selectedRateId || !data.rates.find((r: ShippingRate) => r.id === selectedRateId)) {
          setSelectedRateId(data.rates[0].id)
        }
      }
    } catch {
      // Fallback to flat rate
      setShippingRates([{ id: 'flat', carrier: 'Standard', service: 'Flat Rate', rateCents: FALLBACK_SHIPPING_CENTS, deliveryDays: null }])
      setSelectedRateId('flat')
    } finally {
      setFetchingRates(false)
    }
  }, [shipAddress, shipCity, shipState, shipZip, items, selectedRateId])

  // Debounced rate fetch when ZIP changes
  useEffect(() => {
    if (fulfillment !== 'SHIP' || !shipZip || shipZip.length < 5) return

    const timer = setTimeout(fetchShippingRates, 500)
    return () => clearTimeout(timer)
  }, [fulfillment, shipZip, fetchShippingRates])

  const handleSquareTokenize = useCallback((token: string) => {
    setPaymentToken(token)
    if (tokenResolveRef.current) {
      tokenResolveRef.current(token)
      tokenResolveRef.current = null
    }
  }, [])

  const handleSquareError = useCallback((msg: string) => {
    setError(msg)
    setSubmitting(false)
    if (tokenResolveRef.current) {
      tokenResolveRef.current(null)
      tokenResolveRef.current = null
    }
  }, [])

  if (!mounted) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="font-display text-3xl font-bold text-brand-dark">Checkout</h1>
          <p className="mt-6 text-brand-brown/60">Loading...</p>
        </div>
      </StoreLayout>
    )
  }

  if (items.length === 0) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl font-bold text-brand-dark">Checkout</h1>
          <p className="mt-6 text-brand-brown/60 text-lg">Your cart is empty</p>
          <Link href="/shop" className="btn-primary mt-8 inline-block">
            Continue Shopping
          </Link>
        </div>
      </StoreLayout>
    )
  }

  const subtotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
  const selectedRate = shippingRates.find((r) => r.id === selectedRateId)
  const shipping = fulfillment === 'SHIP'
    ? (selectedRate?.rateCents ?? FALLBACK_SHIPPING_CENTS)
    : 0
  const tax = Math.round(subtotal * TAX_RATE)
  const total = subtotal + shipping + tax

  // Needs an up-front Square tokenization step when the buyer picked a
  // Square tender. MANUAL skips Square entirely.
  const needsPayment =
    (paymentMethod === 'SQUARE_CARD' || paymentMethod === 'SQUARE_CASH_APP') &&
    squareConfigured

  const manualAvailable = Boolean(
    manualHandles?.venmoHandle || manualHandles?.cashAppTag || manualHandles?.paymentInstructions,
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    let token = paymentToken

    if (needsPayment && !token) {
      const el = document.getElementById('square-card-container') as
        (HTMLElement & { tokenize?: () => Promise<void> }) | null
      if (el?.tokenize) {
        const tokenPromise = new Promise<string | null>((resolve) => {
          tokenResolveRef.current = resolve
        })
        await el.tokenize()
        token = await tokenPromise
        if (!token) return
      } else {
        setError('Payment form not ready. Please wait a moment and try again.')
        setSubmitting(false)
        return
      }
    }

    try {
      const body: Record<string, unknown> = {
        customer: { name, email, phone: phone || undefined },
        fulfillment,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      }

      if (fulfillment === 'SHIP') {
        body.shipping = {
          name: shipName,
          address: shipAddress,
          city: shipCity,
          state: shipState,
          zip: shipZip,
        }
        body.shippingRateId = selectedRateId
        body.shippingCentsOverride = shipping
      }

      if (token) {
        body.paymentToken = token
      }
      body.paymentMethod = paymentMethod

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      clearCart()
      router.push(`/order/${data.orderId}`)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-brand-dark">Checkout</h1>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-10 lg:grid-cols-3">
          {/* Left column — form */}
          <div className="lg:col-span-2 space-y-8">
            {/* Contact info */}
            <section className="card">
              <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Contact Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-brand-brown mb-1">Name *</label>
                  <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Your full name" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-brand-brown mb-1">Email *</label>
                  <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-brand-brown mb-1">Phone (optional)</label>
                  <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" placeholder="(555) 555-5555" />
                </div>
              </div>
            </section>

            {/* Fulfillment toggle */}
            <section className="card">
              <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Fulfillment</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillment('SHIP')}
                  className={`flex-1 rounded-lg py-3 text-sm font-medium transition-colors border ${
                    fulfillment === 'SHIP'
                      ? 'bg-brand-terra text-white border-brand-terra'
                      : 'bg-white text-brand-brown border-brand-warm hover:border-brand-terra'
                  }`}
                >
                  Ship to Me
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillment('PICKUP')}
                  className={`flex-1 rounded-lg py-3 text-sm font-medium transition-colors border ${
                    fulfillment === 'PICKUP'
                      ? 'bg-brand-terra text-white border-brand-terra'
                      : 'bg-white text-brand-brown border-brand-warm hover:border-brand-terra'
                  }`}
                >
                  Local Pickup
                </button>
              </div>
            </section>

            {/* Shipping address (if SHIP) */}
            {fulfillment === 'SHIP' && (
              <section className="card">
                <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Shipping Address</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="shipName" className="block text-sm font-medium text-brand-brown mb-1">Recipient Name *</label>
                    <input id="shipName" type="text" required value={shipName} onChange={(e) => setShipName(e.target.value)} className="input" placeholder="Name on package" />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="shipAddress" className="block text-sm font-medium text-brand-brown mb-1">Address *</label>
                    <input id="shipAddress" type="text" required value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} className="input" placeholder="Street address" />
                  </div>
                  <div>
                    <label htmlFor="shipCity" className="block text-sm font-medium text-brand-brown mb-1">City *</label>
                    <input id="shipCity" type="text" required value={shipCity} onChange={(e) => setShipCity(e.target.value)} className="input" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="shipState" className="block text-sm font-medium text-brand-brown mb-1">State *</label>
                      <select id="shipState" required value={shipState} onChange={(e) => setShipState(e.target.value)} className="input">
                        <option value="">--</option>
                        {US_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="shipZip" className="block text-sm font-medium text-brand-brown mb-1">ZIP *</label>
                      <input id="shipZip" type="text" required value={shipZip} onChange={(e) => setShipZip(e.target.value)} className="input" placeholder="25301" maxLength={10} />
                    </div>
                  </div>
                </div>

                {/* Shipping rate selection */}
                <div className="mt-4">
                  {fetchingRates ? (
                    <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown animate-pulse">
                      Calculating shipping rates...
                    </div>
                  ) : shippingRates.length > 0 ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-brand-brown">Shipping Method</label>
                      {shippingRates.map((rate) => (
                        <label
                          key={rate.id}
                          className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                            selectedRateId === rate.id
                              ? 'border-brand-terra bg-brand-terra/5'
                              : 'border-brand-warm/60 hover:border-brand-warm'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shippingRate"
                              value={rate.id}
                              checked={selectedRateId === rate.id}
                              onChange={() => setSelectedRateId(rate.id)}
                              className="text-brand-terra focus:ring-brand-terra"
                            />
                            <div>
                              <span className="text-sm font-medium text-brand-dark">
                                {rate.carrier} {rate.service}
                              </span>
                              {rate.deliveryDays && (
                                <span className="ml-2 text-xs text-brand-brown/60">
                                  ({rate.deliveryDays} day{rate.deliveryDays !== 1 ? 's' : ''})
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-brand-dark">
                            {formatMoney(rate.rateCents)}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown">
                      Flat rate shipping: {formatMoney(FALLBACK_SHIPPING_CENTS)}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Pickup info */}
            {fulfillment === 'PICKUP' && (
              <section className="card">
                <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Pickup Information</h2>
                <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown">
                  <p className="font-medium">Pick up at:</p>
                  <p className="mt-1">Smelly Melly Workshop<br />West Virginia</p>
                  <p className="mt-2 text-brand-brown/60">We will contact you when your order is ready for pickup.</p>
                </div>
              </section>
            )}

            {/* Payment section */}
            <section className="card">
              <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Payment</h2>

              <div className="space-y-2 mb-4">
                {squareConfigured && (
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-brand-warm/60 cursor-pointer hover:bg-surface-warm">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="SQUARE_CARD"
                      checked={paymentMethod === 'SQUARE_CARD'}
                      onChange={() => {
                        setPaymentMethod('SQUARE_CARD')
                        setPaymentToken(null)
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-brand-dark">
                        Credit or debit card
                      </div>
                      <div className="text-xs text-brand-brown/60">
                        Secure checkout powered by Square.
                      </div>
                    </div>
                  </label>
                )}
                {squareConfigured && (
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-brand-warm/60 cursor-pointer hover:bg-surface-warm">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="SQUARE_CASH_APP"
                      checked={paymentMethod === 'SQUARE_CASH_APP'}
                      onChange={() => {
                        setPaymentMethod('SQUARE_CASH_APP')
                        setPaymentToken(null)
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-brand-dark">
                        Cash App Pay
                      </div>
                      <div className="text-xs text-brand-brown/60">
                        Pay through Cash App — redirect to approve.
                      </div>
                    </div>
                  </label>
                )}
                <label className="flex items-start gap-3 p-3 rounded-lg border border-brand-warm/60 cursor-pointer hover:bg-surface-warm">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MANUAL"
                    checked={paymentMethod === 'MANUAL'}
                    onChange={() => {
                      setPaymentMethod('MANUAL')
                      setPaymentToken(null)
                    }}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-brand-dark">
                      {fulfillment === 'PICKUP'
                        ? 'Pay at pickup (cash, Venmo, or Cash App)'
                        : 'Send payment directly via Venmo or Cash App'}
                    </div>
                    <div className="text-xs text-brand-brown/60">
                      {fulfillment === 'PICKUP'
                        ? 'You\u2019ll see payment details on the next screen. Bring cash or send via Venmo / Cash App when you pick up.'
                        : 'You\u2019ll see payment instructions next. Order stays pending until payment is received.'}
                    </div>
                  </div>
                </label>
              </div>

              {paymentMethod === 'SQUARE_CARD' && (
                <SquarePaymentForm
                  onTokenize={handleSquareTokenize}
                  onError={handleSquareError}
                  disabled={submitting}
                />
              )}

              {paymentMethod === 'SQUARE_CASH_APP' && total > 0 && (
                <SquareCashAppPay
                  amountCents={total}
                  referenceId={`checkout-${Date.now()}`}
                  onTokenize={handleSquareTokenize}
                  onError={handleSquareError}
                  disabled={submitting}
                />
              )}

              {paymentMethod === 'MANUAL' && (
                <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown space-y-2">
                  <p className="font-medium">How this works:</p>
                  <ol className="list-decimal pl-5 space-y-1 text-brand-brown/80">
                    <li>Place your order — it will be marked <em>pending</em>.</li>
                    <li>You&apos;ll see payment instructions on the next screen and in your confirmation email.</li>
                    <li>Send payment to the Venmo / Cash App handle listed with your order number in the memo.</li>
                    <li>Mel will mark your order paid and ship / prepare it as usual.</li>
                  </ol>
                  {!manualAvailable && (
                    <p className="text-xs text-amber-700 mt-2">
                      Note: payment handles aren&apos;t set up yet. Mel will email you directly with instructions.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Placing Order...' : needsPayment ? `Pay ${formatMoney(total)}` : 'Place Order'}
            </button>
          </div>

          {/* Right column — order summary */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24">
              <h2 className="font-display text-xl font-bold text-brand-dark mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.variantId} className="flex justify-between text-sm">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="font-medium text-brand-dark truncate">{item.productName}</p>
                      <p className="text-brand-brown/60 text-xs">{item.variantName} x {item.quantity}</p>
                    </div>
                    <span className="text-brand-dark font-medium flex-shrink-0">
                      {formatMoney(item.priceCents * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-brand-warm/40 pt-3 space-y-2 text-sm">
                <div className="flex justify-between text-brand-brown">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                {fulfillment === 'SHIP' && (
                  <div className="flex justify-between text-brand-brown">
                    <span>Shipping</span>
                    <span>{fetchingRates ? '...' : formatMoney(shipping)}</span>
                  </div>
                )}
                <div className="flex justify-between text-brand-brown/60">
                  <span>Tax (6%)</span>
                  <span>{formatMoney(tax)}</span>
                </div>
                <div className="border-t border-brand-warm/40 pt-2 flex justify-between font-semibold text-brand-dark text-base">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </StoreLayout>
  )
}
