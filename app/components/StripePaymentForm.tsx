'use client'

import { forwardRef, useImperativeHandle } from 'react'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

/**
 * Embedded Stripe card field (Payment Element), rendered inside an <Elements>
 * provider configured in deferred mode (mode: 'payment', amount, currency).
 *
 * Confirmation is imperative: the parent's "Place Order" handler calls
 * `ref.confirm(cartPayload)`, which validates the card, asks the server to
 * create a PaymentIntent for the authoritative amount, confirms it in-page
 * (handling 3-D Secure without leaving the site), and resolves with the
 * succeeded PaymentIntent id — which the parent then sends to /api/checkout.
 */

export interface StripePayload {
  customer: { name: string; email: string; phone?: string }
  fulfillment: 'SHIP' | 'PICKUP'
  items: { variantId: string; quantity: number }[]
  shippingCentsOverride?: number
}

export interface StripeFormHandle {
  confirm: (payload: StripePayload) => Promise<string>
}

const StripePaymentForm = forwardRef<StripeFormHandle, { disabled?: boolean }>(
  function StripePaymentForm({ disabled }, ref) {
    const stripe = useStripe()
    const elements = useElements()

    useImperativeHandle(
      ref,
      () => ({
        confirm: async (payload: StripePayload): Promise<string> => {
          if (!stripe || !elements) {
            throw new Error('Payment form is still loading. Please wait a moment and try again.')
          }

          // Validate the card fields (required before confirm in deferred mode).
          const submit = await elements.submit()
          if (submit.error) {
            throw new Error(submit.error.message || 'Please check your card details.')
          }

          // Ask the server for a PaymentIntent whose amount it computed itself.
          const res = await fetch('/api/checkout/payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const json = await res.json()
          if (!res.ok || !json.clientSecret) {
            throw new Error(json.error || 'Could not start card payment. Please try again.')
          }

          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            clientSecret: json.clientSecret,
            // return_url is required by Stripe.js whenever any redirect-capable
            // method could be used. We disable redirect methods on the PI
            // (allow_redirects:'never') so card/Link confirm in-page and never
            // actually use this — but it must be a valid URL or confirm throws
            // "return_url is required when using automatic payment methods".
            confirmParams: {
              return_url: `${window.location.origin}/checkout`,
            },
            redirect: 'if_required',
          })
          if (error) {
            throw new Error(error.message || 'Payment failed. Please try again.')
          }
          if (!paymentIntent || paymentIntent.status !== 'succeeded') {
            throw new Error('Payment was not completed. Please try again.')
          }
          return paymentIntent.id
        },
      }),
      [stripe, elements],
    )

    return (
      <div className={`rounded-lg border border-brand-warm/60 p-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Apple Pay / Google Pay show as express buttons here automatically on
            supported devices — the smellymellys.net domain is registered with
            Stripe (payment_method_domains) so both are active. */}
        <PaymentElement
          options={{ layout: 'tabs', wallets: { applePay: 'auto', googlePay: 'auto' } }}
        />
      </div>
    )
  },
)

export default StripePaymentForm
