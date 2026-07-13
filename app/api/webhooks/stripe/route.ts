import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { prisma } from '@/app/lib/prisma'
import { getStripe, getStripeWebhookSecret, isStripeConfigured } from '@/app/lib/stripe'
import { sendAdminAlert } from '@/app/lib/email'

// Stripe needs the raw, unparsed request body to verify the signature, so this
// route reads req.text() directly and never touches req.json(). Node runtime so
// the Stripe SDK's crypto works and Prisma is available.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function money(cents: number | null): string {
  return cents == null ? '(unknown)' : `$${(cents / 100).toFixed(2)}`
}

/**
 * Stripe webhook — reconciliation safety net for card checkout.
 *
 * The happy path creates the order synchronously in /api/checkout right after
 * the card is confirmed. The rare failure mode is: the card charges, then the
 * browser dies (or /api/checkout errors) before the order row is written — money
 * captured, no order. This endpoint catches that: on payment_intent.succeeded it
 * checks whether an order already exists for the PaymentIntent; if not, it emails
 * the owner to reconcile (the cart contents aren't in the PI metadata, so it
 * can't rebuild the order itself — it flags it for a human).
 *
 * Always returns 2xx once the signature is valid so Stripe stops retrying; real
 * processing failures are logged + alerted, not surfaced as 5xx retry storms.
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 503 })
  }

  const secret = getStripeWebhookSecret()
  if (!secret) {
    // Fail loud but don't 200 — a missing secret means we can't trust anything.
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set; rejecting.')
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent

      const existing = await prisma.sM_Order.findFirst({
        where: { stripePaymentIntentId: pi.id },
        select: { id: true, orderNumber: true },
      })

      if (existing) {
        // Normal case — /api/checkout already created the order. Nothing to do.
        console.log(
          `[stripe-webhook] PI ${pi.id} already reconciled to order ${existing.orderNumber}.`,
        )
      } else {
        // Captured money with no order. Flag a human — we can't rebuild the
        // cart from the PI, but we surface everything needed to find the buyer.
        const email = pi.metadata?.customerEmail || pi.receipt_email || '(unknown)'
        console.error(
          `[stripe-webhook] ORPHAN PAYMENT: PI ${pi.id} succeeded (${money(pi.amount_received)}) but no order exists. Buyer: ${email}`,
        )
        await sendAdminAlert({
          subject: 'Card charged but no order was recorded',
          lines: [
            'A Stripe card payment succeeded but no matching order exists in the store.',
            'This usually means the customer paid but their browser closed before the order finished saving.',
            '',
            `Amount charged: ${money(pi.amount_received)}`,
            `Customer email: ${email}`,
            `Fulfillment: ${pi.metadata?.fulfillment || '(unknown)'}`,
            `Stripe PaymentIntent: ${pi.id}`,
            '',
            'What to do: open this payment in the Stripe dashboard to see the customer + receipt,',
            'then either create the order manually or refund the charge if it can\'t be fulfilled.',
          ],
        }).catch((err) => console.error('[stripe-webhook] alert email failed:', err))
      }
    }
    // Other event types are acknowledged and ignored.

    return NextResponse.json({ received: true })
  } catch (err) {
    // Don't ask Stripe to retry forever on our own bugs — log, alert, ack.
    console.error(`[stripe-webhook] handler error for ${event.type} (${event.id}):`, err)
    return NextResponse.json({ received: true, handlerError: true })
  }
}
