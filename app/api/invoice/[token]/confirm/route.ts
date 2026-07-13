import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'

interface Body {
  paymentIntentId?: string
}

/**
 * Marks an invoice PAID after the customer confirms the card in-page. The
 * PaymentIntent is re-verified with Stripe (status + amount) so a client can't
 * flip the invoice to paid without a real, matching charge.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Online payment is not available.' }, { status: 400 })
    }

    const { token } = await params
    const body = (await req.json()) as Body
    if (!body.paymentIntentId) {
      return NextResponse.json({ error: 'Missing payment reference.' }, { status: 400 })
    }

    const invoice = await prisma.sM_Invoice.findUnique({ where: { payToken: token } })
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
    }
    if (invoice.status === 'PAID') {
      return NextResponse.json({ ok: true, alreadyPaid: true })
    }

    const stripe = getStripe()
    const intent = await stripe.paymentIntents.retrieve(body.paymentIntentId)
    if (intent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment was not completed. Please try again.' }, { status: 400 })
    }
    if (intent.amount_received !== invoice.totalCents) {
      console.error(
        `Invoice amount mismatch: PI ${intent.id} received ${intent.amount_received} vs invoice ${invoice.totalCents}`,
      )
      return NextResponse.json(
        { error: 'Payment amount did not match the invoice. Please contact Smelly Melly.' },
        { status: 400 },
      )
    }
    // Bind the PI to this invoice — never let one invoice be closed by a charge
    // created for a different invoice or by a storefront-checkout PI. Our
    // /pay-intent route always stamps metadata.invoiceId, so require an exact
    // match (absent metadata is rejected too).
    if (intent.metadata?.invoiceId !== invoice.id) {
      return NextResponse.json({ error: 'Payment does not belong to this invoice.' }, { status: 400 })
    }

    await prisma.sM_Invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date(), stripePaymentIntentId: intent.id },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Invoice confirm error:', err)
    return NextResponse.json({ error: 'Could not confirm payment. Please contact Smelly Melly.' }, { status: 500 })
  }
}
