import { NextRequest, NextResponse } from 'next/server'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'
import { computeCheckout } from '@/app/lib/checkout-totals'

interface Body {
  customer?: { email?: string; name?: string }
  fulfillment?: 'SHIP' | 'PICKUP'
  items?: { variantId: string; quantity: number }[]
  shippingCentsOverride?: number
}

/**
 * Creates (the amount for) a Stripe PaymentIntent from the current cart.
 * The client uses the deferred-payment flow: it calls this at confirm time,
 * gets back a clientSecret, then confirms the card in-page. The amount here is
 * authoritative — computed server-side via computeCheckout, never trusted from
 * the client. The order row is created later by /api/checkout, which recomputes
 * the same total and verifies it matches the charged PaymentIntent.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Card payments are temporarily unavailable. Please pick another option.' },
        { status: 400 },
      )
    }

    const body = (await req.json()) as Body
    const email = body.customer?.email?.trim()
    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }
    if (body.fulfillment !== 'SHIP' && body.fulfillment !== 'PICKUP') {
      return NextResponse.json({ error: 'Invalid fulfillment type.' }, { status: 400 })
    }

    const computed = await computeCheckout({
      items: body.items ?? [],
      fulfillment: body.fulfillment,
      email,
      shippingCentsOverride: body.shippingCentsOverride,
    })
    if (!computed.ok) {
      return NextResponse.json({ error: computed.error }, { status: computed.status })
    }

    const { totalCents } = computed.data
    // Stripe rejects charges under $0.50.
    if (totalCents < 50) {
      return NextResponse.json({ error: 'Order total is below the minimum card amount.' }, { status: 400 })
    }

    const stripe = getStripe()
    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      description: `Smelly Melly order for ${body.customer?.name?.trim() || email}`,
      metadata: {
        customerEmail: email,
        fulfillment: body.fulfillment,
        itemCount: String(body.items?.length ?? 0),
      },
    })

    return NextResponse.json({ clientSecret: intent.client_secret, amountCents: totalCents })
  } catch (err) {
    console.error('PaymentIntent error:', err)
    return NextResponse.json({ error: 'Could not start card payment. Please try again.' }, { status: 500 })
  }
}
