import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { getSquareClient, getSquareLocationId, isSquareConfigured } from '@/app/lib/square'
import { sendOrderConfirmation } from '@/app/lib/email'
import { randomUUID } from 'crypto'

interface CheckoutItem {
  variantId: string
  quantity: number
}

interface CheckoutBody {
  customer: { name: string; email: string; phone?: string }
  fulfillment: 'SHIP' | 'PICKUP'
  shipping?: { name: string; address: string; city: string; state: string; zip: string }
  items: CheckoutItem[]
  paymentToken?: string // Square Web Payments SDK nonce
  shippingCentsOverride?: number // from rate calculation
}

const SHIPPING_CENTS = 599

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

    // Require payment token for shipped orders when Square is configured
    const squareReady = isSquareConfigured()
    if (body.fulfillment === 'SHIP' && squareReady && !body.paymentToken) {
      return NextResponse.json({ error: 'Payment is required for shipped orders.' }, { status: 400 })
    }

    // --- Load variants & verify stock ---
    const variantIds = body.items.map((i) => i.variantId)
    const variants = await prisma.sM_ProductVariant.findMany({
      where: { id: { in: variantIds }, isActive: true },
    })

    const variantMap = new Map(variants.map((v) => [v.id, v]))

    for (const item of body.items) {
      const variant = variantMap.get(item.variantId)
      if (!variant) {
        return NextResponse.json({ error: `Product variant not found: ${item.variantId}` }, { status: 400 })
      }
      if (item.quantity < 1) {
        return NextResponse.json({ error: 'Quantity must be at least 1.' }, { status: 400 })
      }
      if (variant.stockQuantity < item.quantity) {
        return NextResponse.json(
          { error: `Not enough stock for "${variant.name}". Available: ${variant.stockQuantity}` },
          { status: 400 },
        )
      }
    }

    // --- Load tax rate from settings ---
    const settings = await prisma.sM_Settings.findFirst({ where: { id: 'singleton' } })
    const taxRate = settings?.taxRate ?? 0.06

    // --- Calculate totals ---
    const orderItems = body.items.map((item) => {
      const variant = variantMap.get(item.variantId)!
      return {
        variantId: variant.id,
        productName: variant.name,
        variantName: variant.name,
        quantity: item.quantity,
        unitCents: variant.priceCents,
        totalCents: variant.priceCents * item.quantity,
      }
    })

    // Load product names for order items
    const variantsWithProduct = await prisma.sM_ProductVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    })
    const variantProductMap = new Map(variantsWithProduct.map((v) => [v.id, v]))

    for (const oi of orderItems) {
      const vp = variantProductMap.get(oi.variantId)
      if (vp) {
        oi.productName = vp.product.name
        oi.variantName = vp.name
      }
    }

    const subtotalCents = orderItems.reduce((sum, i) => sum + i.totalCents, 0)
    const shippingCents = body.fulfillment === 'SHIP'
      ? (body.shippingCentsOverride && body.shippingCentsOverride > 0
          ? body.shippingCentsOverride
          : SHIPPING_CENTS)
      : 0
    const taxCents = Math.round(subtotalCents * taxRate)
    const totalCents = subtotalCents + shippingCents + taxCents

    // --- Process Square payment if token provided ---
    let squarePaymentId: string | null = null
    if (body.paymentToken && squareReady) {
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
          status: squarePaymentId ? 'PAID' : 'PENDING',
          fulfillment: body.fulfillment,
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
          squarePaymentId,
          paidAt: squarePaymentId ? new Date() : null,
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
