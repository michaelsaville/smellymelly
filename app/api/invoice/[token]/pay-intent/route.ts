import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'

/**
 * Creates a Stripe PaymentIntent for an invoice's balance, keyed by its
 * unguessable payToken. The customer confirms the card in-page, then hits
 * /confirm which verifies with Stripe before marking the invoice PAID.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Online payment is not available right now. Please contact Smelly Melly.' },
        { status: 400 },
      )
    }

    const { token } = await params
    const invoice = await prisma.sM_Invoice.findUnique({ where: { payToken: token } })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
    }
    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'This invoice has already been paid.' }, { status: 409 })
    }
    if (invoice.status === 'CANCELLED') {
      return NextResponse.json({ error: 'This invoice has been cancelled.' }, { status: 409 })
    }
    if (invoice.totalCents < 50) {
      return NextResponse.json({ error: 'This invoice total is below the minimum card amount.' }, { status: 400 })
    }

    const stripe = getStripe()
    const intent = await stripe.paymentIntents.create({
      amount: invoice.totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      receipt_email: invoice.customerEmail ?? undefined,
      description: `Smelly Melly invoice #${invoice.invoiceNumber} — ${invoice.customerName}`,
      metadata: { invoiceId: invoice.id, invoiceNumber: String(invoice.invoiceNumber) },
    })

    // Track the latest PI so /confirm can cross-check and reconciliation is possible.
    await prisma.sM_Invoice.update({
      where: { id: invoice.id },
      data: { stripePaymentIntentId: intent.id },
    })

    return NextResponse.json({ clientSecret: intent.client_secret, amountCents: invoice.totalCents })
  } catch (err) {
    console.error('Invoice pay-intent error:', err)
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 500 })
  }
}
