'use client'

import { useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

/** Inner form — must live inside <Elements> to use the Stripe hooks. */
function PayForm({ token, amountCents }: { token: string; amountCents: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function pay() {
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    try {
      const submit = await elements.submit()
      if (submit.error) {
        setError(submit.error.message || 'Please check your card details.')
        setBusy(false)
        return
      }

      // Ask the server for a PaymentIntent whose amount it computes itself.
      const res = await fetch(`/api/invoice/${token}/pay-intent`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.clientSecret) {
        setError(json.error || 'Could not start payment. Please try again.')
        setBusy(false)
        return
      }

      const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: json.clientSecret,
        confirmParams: { return_url: `${window.location.origin}/invoice/${token}` },
        redirect: 'if_required',
      })
      if (confirmErr) {
        setError(confirmErr.message || 'Payment failed. Please try again.')
        setBusy(false)
        return
      }
      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        setError('Payment was not completed. Please try again.')
        setBusy(false)
        return
      }

      // Have the server verify + mark the invoice paid.
      const confirmRes = await fetch(`/api/invoice/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      })
      const confirmJson = await confirmRes.json()
      if (!confirmRes.ok || !confirmJson.ok) {
        setError(confirmJson.error || 'Payment went through but we could not record it. Please contact Smelly Melly.')
        setBusy(false)
        return
      }

      setDone(true)
      setTimeout(() => window.location.reload(), 1200)
    } catch {
      setError('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Payment received — thank you! Refreshing…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={pay} disabled={busy} className="btn-primary w-full py-3 disabled:opacity-50">
        {busy ? 'Processing…' : `Pay ${formatMoney(amountCents)}`}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-brand-brown/60">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secure encrypted payment via Stripe.
      </p>
    </div>
  )
}

export default function InvoicePayClient({
  token,
  amountCents,
  publishableKey,
}: {
  token: string
  amountCents: number
  publishableKey: string
}) {
  // loadStripe is safe to call in render; it memoizes internally per key.
  const [stripePromise] = useState<Promise<Stripe | null>>(() => loadStripe(publishableKey))

  return (
    <Elements
      stripe={stripePromise}
      options={{ mode: 'payment', amount: amountCents, currency: 'usd', appearance: { theme: 'stripe' } }}
    >
      <PayForm token={token} amountCents={amountCents} />
    </Elements>
  )
}
