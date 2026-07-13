'use client'

import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import StoreLayout from '@/app/components/StoreLayout'
import StripePaymentForm, { type StripeFormHandle } from '@/app/components/StripePaymentForm'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
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
  const [isGift, setIsGift] = useState(false)
  const [giftMessage, setGiftMessage] = useState('')
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
  type PaymentMethod = 'STRIPE_CARD' | 'MANUAL'
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('STRIPE_CARD')
  const [stripeConfigured, setStripeConfigured] = useState(false)
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [manualHandles, setManualHandles] = useState<{
    venmoHandle: string
    cashAppTag: string
    paymentInstructions: string
  } | null>(null)
  const stripeFormRef = useRef<StripeFormHandle>(null)

  // Promo/discount code
  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState<{ code: string; discountCents: number } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoChecking, setPromoChecking] = useState(false)

  const refresh = useCallback(() => setItems(getCart()), [])

  useEffect(() => {
    setMounted(true)
    refresh()
    fetch('/api/stripe/config')
      .then((r) => r.json())
      .then((cfg) => {
        setStripeConfigured(cfg.configured)
        if (cfg.configured && cfg.publishableKey) {
          setStripePromise(loadStripe(cfg.publishableKey))
        } else {
          setPaymentMethod('MANUAL')
        }
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
  // Promo discount can't exceed the merchandise subtotal. Tax is charged on the
  // discounted subtotal (mirrors computeCheckout on the server).
  const discount = promo ? Math.min(promo.discountCents, subtotal) : 0
  const taxable = subtotal - discount
  const tax = Math.round(taxable * TAX_RATE)
  const total = taxable + shipping + tax

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) return
    setPromoChecking(true)
    setPromoError(null)
    try {
      const res = await fetch('/api/checkout/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          email,
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setPromo(null)
        setPromoError(json.error || 'That code could not be applied.')
      } else {
        setPromo({ code: json.code, discountCents: json.discountCents })
        setPromoError(null)
      }
    } catch {
      setPromoError('Could not check that code. Please try again.')
    } finally {
      setPromoChecking(false)
    }
  }

  function clearPromo() {
    setPromo(null)
    setPromoInput('')
    setPromoError(null)
  }

  // Card checkout requires an in-page Stripe confirmation. MANUAL skips it.
  const needsPayment = paymentMethod === 'STRIPE_CARD' && stripeConfigured

  const manualAvailable = Boolean(
    manualHandles?.venmoHandle || manualHandles?.cashAppTag || manualHandles?.paymentInstructions,
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const cartItems = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }))
      const body: Record<string, unknown> = {
        customer: { name, email, phone: phone || undefined },
        fulfillment,
        items: cartItems,
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

      body.paymentMethod = paymentMethod
      body.isGift = isGift
      if (isGift && giftMessage.trim()) body.giftMessage = giftMessage.trim()
      if (promo) body.discountCode = promo.code

      // Card checkout: confirm the card in-page with Stripe first (this is what
      // actually charges), then hand the succeeded PaymentIntent id to the
      // server, which re-verifies status + amount before saving a PAID order.
      if (paymentMethod === 'STRIPE_CARD' && stripeConfigured) {
        if (!stripeFormRef.current) {
          setError('Payment form is still loading. Please wait a moment and try again.')
          setSubmitting(false)
          return
        }
        const piId = await stripeFormRef.current.confirm({
          customer: { name, email, phone: phone || undefined },
          fulfillment,
          items: cartItems,
          shippingCentsOverride: fulfillment === 'SHIP' ? shipping : undefined,
          discountCode: promo?.code,
        })
        body.stripePaymentIntentId = piId
      }

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error. Please try again.')
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

            {/* Gift options */}
            <section className="card">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGift}
                  onChange={(e) => setIsGift(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="font-display text-lg font-bold text-brand-dark">🎁 This is a gift</span>
              </label>
              {isGift && (
                <div className="mt-4">
                  <label htmlFor="giftMessage" className="block text-sm font-medium text-brand-brown mb-1">
                    Gift message (we&apos;ll include a handwritten note)
                  </label>
                  <textarea
                    id="giftMessage"
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value.slice(0, 300))}
                    rows={3}
                    className="input resize-y"
                    placeholder="Happy Birthday! Enjoy a little self-care. 💛"
                  />
                  <p className="mt-1 text-xs text-brand-brown/50">{giftMessage.length}/300</p>
                </div>
              )}
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
                  <p className="mt-1">Smelly Melly Workshop<br />Cumberland, MD</p>
                  <p className="mt-2 text-brand-brown/60">We will contact you when your order is ready for pickup.</p>
                </div>
              </section>
            )}

            {/* Payment section */}
            <section className="card">
              <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Payment</h2>

              <div className="space-y-2 mb-4">
                {stripeConfigured && (
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-brand-warm/60 cursor-pointer hover:bg-surface-warm">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="STRIPE_CARD"
                      checked={paymentMethod === 'STRIPE_CARD'}
                      onChange={() => setPaymentMethod('STRIPE_CARD')}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium text-brand-dark">
                        Credit or debit card
                      </div>
                      <div className="text-xs text-brand-brown/60">
                        Secure checkout powered by Stripe.
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
                    onChange={() => setPaymentMethod('MANUAL')}
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

              {paymentMethod === 'STRIPE_CARD' && stripeConfigured && stripePromise && total >= 50 && (
                <Elements
                  stripe={stripePromise}
                  options={{
                    mode: 'payment',
                    amount: total,
                    currency: 'usd',
                    appearance: { theme: 'stripe' },
                  }}
                >
                  <StripePaymentForm ref={stripeFormRef} disabled={submitting} />
                </Elements>
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
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-brand-brown/60">
              <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              {needsPayment
                ? 'Secure encrypted checkout — your card is processed by Stripe. We never see your card number.'
                : 'Handmade in Cumberland, MD. Your details are kept private.'}
            </p>
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
              {/* Promo code */}
              <div className="border-t border-brand-warm/40 pt-3 mb-3">
                {promo ? (
                  <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm">
                    <span className="text-green-800">
                      Code <span className="font-semibold">{promo.code}</span> applied
                    </span>
                    <button
                      type="button"
                      onClick={clearPromo}
                      className="text-xs text-green-700 underline hover:text-green-900"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyPromo()
                        }
                      }}
                      placeholder="Promo code"
                      className="input flex-1 text-sm uppercase"
                      aria-label="Promo code"
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoChecking || !promoInput.trim()}
                      className="btn-secondary whitespace-nowrap text-sm disabled:opacity-50"
                    >
                      {promoChecking ? '…' : 'Apply'}
                    </button>
                  </div>
                )}
                {promoError && <p className="mt-1.5 text-xs text-red-600">{promoError}</p>}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-brand-brown">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Discount{promo ? ` (${promo.code})` : ''}</span>
                    <span>−{formatMoney(discount)}</span>
                  </div>
                )}
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
