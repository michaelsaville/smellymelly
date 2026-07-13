import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { getSquareClient, getSquareLocationId, isSquareConfigured } from '@/app/lib/square'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'
import { computeCheckout } from '@/app/lib/checkout-totals'
import { sendOrderConfirmation } from '@/app/lib/email'
import { upsertCustomerFromOrder } from '@/app/lib/customers'
import { randomUUID } from 'crypto'

interface CheckoutItem {
  variantId: string
  quantity: number
}

type PaymentMethod = 'STRIPE_CARD' | 'SQUARE_CARD' | 'SQUARE_CASH_APP' | 'MANUAL'

interface CheckoutBody {
  customer: { name: string; email: string; phone?: string }
  fulfillment: 'SHIP' | 'PICKUP'
  shipping?: { name: string; address: string; city: string; state: string; zip: string }
  items: CheckoutItem[]
  paymentToken?: string // Square Web Payments SDK nonce (card or cash-app)
  stripePaymentIntentId?: string // Stripe PaymentIntent id, already confirmed client-side
  paymentMethod?: PaymentMethod
  shippingCentsOverride?: number // from rate calculation
  isGift?: boolean
  giftMessage?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CheckoutBody

    // --- Validation ---
    if (!body.customer?.name?.trim()) {
      return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 })
    }
    if (!body.customer?.email?.trim()) {
      return NextResponse.json({ error: 'Customer email is required.' }, { status: 400 })
    }
    if (!body.items?.length) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 })
    }
    if (body.fulfillment !== 'SHIP' && body.fulfillment !== 'PICKUP') {
      return NextResponse.json({ error: 'Invalid fulfillment type.' }, { status: 400 })
    }
    if (body.fulfillment === 'SHIP') {
      const s = body.shipping
      if (!s?.name?.trim() || !s?.address?.trim() || !s?.city?.trim() || !s?.state?.trim() || !s?.zip?.trim()) {
        return NextResponse.json({ error: 'Complete shipping address is required for delivery orders.' }, { status: 400 })
      }
    }

    // Resolve payment method. Defaults to SQUARE_CARD for backward compat
    // with any old clients that only send paymentToken.
    const paymentMethod: PaymentMethod =
      body.paymentMethod ??
      (body.paymentToken ? 'SQUARE_CARD' : 'MANUAL')

    const squareReady = isSquareConfigured()
    const isSquareTender = paymentMethod === 'SQUARE_CARD' || paymentMethod === 'SQUARE_CASH_APP'

    if (isSquareTender && !squareReady) {
      return NextResponse.json(
        { error: 'Card payments are temporarily unavailable. Please pick another option.' },
        { status: 400 },
      )
    }
    if (isSquareTender && !body.paymentToken) {
      return NextResponse.json(
        { error: 'Payment token is required for card / Cash App Pay.' },
        { status: 400 },
      )
    }

    const isStripeTender = paymentMethod === 'STRIPE_CARD'
    if (isStripeTender && !isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Card payments are temporarily unavailable. Please pick another option.' },
        { status: 400 },
      )
    }
    if (isStripeTender && !body.stripePaymentIntentId) {
      return NextResponse.json(
        { error: 'Payment confirmation is required for card checkout.' },
        { status: 400 },
      )
    }

    // --- Compute + validate cart (single source of truth for money math,
    // shared with the Stripe PaymentIntent route so amounts can't drift) ---
    const computed = await computeCheckout({
      items: body.items,
      fulfillment: body.fulfillment,
      email: body.customer.email,
      shippingCentsOverride: body.shippingCentsOverride,
    })
    if (!computed.ok) {
      return NextResponse.json({ error: computed.error }, { status: computed.status })
    }
    const { orderItems, subtotalCents, shippingCents, taxCents, totalCents } = computed.data

    // --- Process Square payment if applicable ---
    let squarePaymentId: string | null = null
    if (isSquareTender && body.paymentToken && squareReady) {
      try {
        const square = getSquareClient()
        const paymentResult = await square.payments.create({
          sourceId: body.paymentToken,
          idempotencyKey: randomUUID(),
          amountMoney: {
            amount: BigInt(totalCents),
            currency: 'USD',
          },
          locationId: getSquareLocationId(),
          buyerEmailAddress: body.customer.email.trim(),
          note: `Smelly Melly order for ${body.customer.name.trim()}`,
        })

        if (!paymentResult.payment?.id) {
          return NextResponse.json({ error: 'Payment processing failed. Please try again.' }, { status: 400 })
        }

        squarePaymentId = paymentResult.payment.id
      } catch (err) {
        console.error('Square payment error:', err)
        return NextResponse.json({ error: 'Payment failed. Please check your card details and try again.' }, { status: 400 })
      }
    }

    // --- Verify Stripe payment if applicable ---
    // The card was already confirmed client-side. Here we authoritatively ask
    // Stripe whether it actually succeeded AND that the captured amount equals
    // the total we just computed, before we ever create a PAID order.
    let stripePaymentIntentId: string | null = null
    if (isStripeTender && body.stripePaymentIntentId) {
      try {
        const stripe = getStripe()
        const intent = await stripe.paymentIntents.retrieve(body.stripePaymentIntentId)
        if (intent.status !== 'succeeded') {
          return NextResponse.json({ error: 'Payment was not completed. Please try again.' }, { status: 400 })
        }
        if (intent.amount_received !== totalCents) {
          console.error(
            `Stripe amount mismatch: PI ${intent.id} received ${intent.amount_received} vs expected ${totalCents}`,
          )
          return NextResponse.json(
            { error: 'Payment amount did not match your order total. Please contact us before retrying.' },
            { status: 400 },
          )
        }
        stripePaymentIntentId = intent.id
      } catch (err) {
        console.error('Stripe verify error:', err)
        return NextResponse.json(
          { error: 'Could not verify your payment. Please contact us before retrying.' },
          { status: 400 },
        )
      }
    }

    const paidNow = !!squarePaymentId || !!stripePaymentIntentId

    // --- Create order + items + deduct stock in a transaction ---
    const order = await prisma.$transaction(async (tx) => {
      // Deduct stock
      for (const item of body.items) {
        await tx.sM_ProductVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        })
      }

      // Create order with items
      const created = await tx.sM_Order.create({
        data: {
          status: paidNow ? 'PAID' : 'PENDING',
          fulfillment: body.fulfillment,
          isGift: !!body.isGift,
          giftMessage: body.isGift ? body.giftMessage?.trim() || null : null,
          customerName: body.customer.name.trim(),
          customerEmail: body.customer.email.trim(),
          customerPhone: body.customer.phone?.trim() || null,
          shippingName: body.fulfillment === 'SHIP' ? body.shipping!.name.trim() : null,
          shippingAddress: body.fulfillment === 'SHIP' ? body.shipping!.address.trim() : null,
          shippingCity: body.fulfillment === 'SHIP' ? body.shipping!.city.trim() : null,
          shippingState: body.fulfillment === 'SHIP' ? body.shipping!.state.trim() : null,
          shippingZip: body.fulfillment === 'SHIP' ? body.shipping!.zip.trim() : null,
          subtotalCents,
          shippingCents,
          taxCents,
          totalCents,
          paymentMethod,
          squarePaymentId,
          stripePaymentIntentId,
          paidAt: paidNow ? new Date() : null,
          items: {
            create: orderItems.map((oi) => ({
              variantId: oi.variantId,
              productName: oi.productName,
              variantName: oi.variantName,
              quantity: oi.quantity,
              unitCents: oi.unitCents,
              totalCents: oi.totalCents,
            })),
          },
        },
      })

      return created
    })

    // Link to a customer row (dedupe by email) + refresh denormalized stats.
    // Awaited so the customer is queryable immediately after checkout, but
    // wrapped so a CRM hiccup never fails the order.
    try {
      await upsertCustomerFromOrder(order)
    } catch (err) {
      console.error(`[crm] upsert for order ${order.id} failed:`, err)
    }

    // Fire-and-forget order-confirmation email. A mail failure must never
    // fail the checkout — the order is already persisted and charged.
    const fullOrder = await prisma.sM_Order.findUnique({
      where: { id: order.id },
      include: { items: true },
    })
    if (fullOrder) {
      sendOrderConfirmation(fullOrder).catch((err) => {
        console.error(`[email] order-confirm for ${fullOrder.id} failed:`, err)
      })
    }

    return NextResponse.json({ orderId: order.id, orderNumber: order.orderNumber })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
