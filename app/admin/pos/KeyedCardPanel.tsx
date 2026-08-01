'use client'

import { useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { startKeyedCardPayment } from '@/app/lib/actions/pos-card'

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * loadStripe kicks off a network fetch, so it must not run per render. One
 * promise per publishable key is plenty — the key never changes at runtime.
 */
const stripeByKey = new Map<string, Promise<Stripe | null>>()
function stripeFor(key: string): Promise<Stripe | null> {
  let p = stripeByKey.get(key)
  if (!p) {
    p = loadStripe(key)
    stripeByKey.set(key, p)
  }
  return p
}

/**
 * Inner form — must live under <Elements> to reach the Stripe hooks, and at
 * module scope so React keeps the card fields mounted between renders rather
 * than remounting them (which would drop what Mel has typed).
 */
function KeyedCardForm({
  amountCents,
  busy,
  disabled,
  onCharged,
}: {
  amountCents: number
  busy: boolean
  disabled: boolean
  onCharged: (paymentIntentId: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [charging, setCharging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function charge() {
    if (!stripe || !elements || charging) return
    setCharging(true)
    setError(null)
    try {
      // Deferred mode requires validating the fields before we mint anything,
      // so a mistyped card doesn't leave a stray PaymentIntent behind.
      const submitted = await elements.submit()
      if (submitted.error) {
        setError(submitted.error.message || 'Please check the card details.')
        return
      }

      const started = await startKeyedCardPayment({ amountCents })
      if (!started.ok) {
        setError(started.error)
        return
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: started.clientSecret,
        // Never actually used — allow_redirects is 'never' on the intent — but
        // Stripe.js still wants a valid URL present.
        confirmParams: { return_url: `${window.location.origin}/admin/pos` },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'The card was declined.')
        return
      }
      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        setError('The payment did not go through. Nothing was charged.')
        return
      }
      // Money has moved. Everything past here is the caller's problem, and it
      // warns loudly rather than inviting a second charge.
      onCharged(paymentIntent.id)
    } catch (err) {
      setError((err as { message?: string })?.message || 'Could not take the card.')
    } finally {
      setCharging(false)
    }
  }

  const locked = busy || charging || disabled

  return (
    <div className="mt-3">
      <div
        className={`rounded-lg border border-brand-warm/60 bg-white p-3 ${
          locked ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }} />
      </div>

      <p className="mt-2 text-xs text-brand-brown/50">
        On an iPad, tap the card number field and choose Scan Card to read it with the camera.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={charge}
        disabled={locked || !stripe}
        className="btn-primary mt-3 h-14 w-full text-base disabled:opacity-50"
      >
        {busy
          ? 'Recording…'
          : charging
            ? 'Charging…'
            : `Charge ${money(amountCents)}`}
      </button>
    </div>
  )
}

/**
 * Typed-card tender for the POS, used when no Terminal reader is set up (or
 * when a reader is set up but the card won't read).
 */
export default function KeyedCardPanel({
  amountCents,
  publishableKey,
  busy,
  disabled = false,
  onCharged,
}: {
  amountCents: number
  publishableKey: string
  busy: boolean
  disabled?: boolean
  onCharged: (paymentIntentId: string) => void
}) {
  const stripePromise = useMemo(() => stripeFor(publishableKey), [publishableKey])

  return (
    <Elements
      // Deferred mode bakes the amount into the Element, so a changed split leg
      // has to rebuild it — otherwise the customer could be shown one figure
      // and charged another.
      key={amountCents}
      stripe={stripePromise}
      options={{
        mode: 'payment',
        amount: amountCents,
        currency: 'usd',
        appearance: { theme: 'stripe' },
      }}
    >
      <KeyedCardForm
        amountCents={amountCents}
        busy={busy}
        disabled={disabled}
        onCharged={onCharged}
      />
    </Elements>
  )
}
