import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { upsertCustomerFromOrder } from '@/app/lib/customers'

interface PartyCheckoutBody {
  customer: { name: string; email: string; phone?: string }
  items: Array<{ variantId: string; quantity: number }>
  note?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const body = (await req.json()) as PartyCheckoutBody

    // --- Campaign + variant validation ---
    const campaign = await prisma.sM_Campaign.findUnique({
      where: { slug },
      include: {
        variants: {
          include: {
            variant: {
              include: { product: { select: { name: true } } },
            },
          },
        },
      },
    })
    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found.' },
        { status: 404 },
      )
    }
    if (campaign.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'This fundraiser is not currently accepting orders.' },
        { status: 400 },
      )
    }
    const now = new Date()
    if (campaign.startsAt && campaign.startsAt > now) {
      return NextResponse.json(
        { error: 'This fundraiser has not started yet.' },
        { status: 400 },
      )
    }
    if (campaign.endsAt && campaign.endsAt < now) {
      return NextResponse.json(
        { error: 'This fundraiser has ended.' },
        { status: 400 },
      )
    }

    // --- Buyer + cart validation ---
    if (!body.customer?.name?.trim() || !body.customer?.email?.trim()) {
      return NextResponse.json(
        { error: 'Name and email are required.' },
        { status: 400 },
      )
    }
    if (!body.items?.length) {
      return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 })
    }

    // Must be campaign-approved variants only
    const allowedVariantIds = new Set(campaign.variants.map((cv) => cv.variantId))
    const variantLookup = new Map(
      campaign.variants.map((cv) => [cv.variantId, cv.variant]),
    )

    for (const item of body.items) {
      if (!allowedVariantIds.has(item.variantId)) {
        return NextResponse.json(
          { error: 'One of the items is not part of this campaign.' },
          { status: 400 },
        )
      }
      if (!Number.isFinite(item.quantity) || item.quantity < 1) {
        return NextResponse.json(
          { error: 'Quantity must be at least 1 for each item.' },
          { status: 400 },
        )
      }
      const variant = variantLookup.get(item.variantId)!
      if (variant.stockQuantity < item.quantity) {
        return NextResponse.json(
          {
            error: `Not enough stock for "${variant.name}". Available: ${variant.stockQuantity}`,
          },
          { status: 400 },
        )
      }
    }

    // --- Build order items at campaign pricing (NOT variant retail) ---
    const unitCents = campaign.customerPriceCents
    const orderItems = body.items.map((item) => {
      const variant = variantLookup.get(item.variantId)!
      return {
        variantId: item.variantId,
        productName: variant.product.name,
        variantName: variant.name,
        quantity: item.quantity,
        unitCents,
        totalCents: unitCents * item.quantity,
      }
    })

    const subtotalCents = orderItems.reduce((s, i) => s + i.totalCents, 0)
    // No shipping, no tax on party fundraisers — simplest-case fulfillment.
    const shippingCents = 0
    const taxCents = 0
    const totalCents = subtotalCents

    // --- Transaction: decrement stock + create order ---
    const order = await prisma.$transaction(async (tx) => {
      for (const item of body.items) {
        await tx.sM_ProductVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        })
      }
      const created = await tx.sM_Order.create({
        data: {
          status: 'PENDING',
          fulfillment: 'HOST_DELIVERY',
          paymentMethod: 'MANUAL',
          customerName: body.customer.name.trim(),
          customerEmail: body.customer.email.trim().toLowerCase(),
          customerPhone: body.customer.phone?.trim() || null,
          subtotalCents,
          shippingCents,
          taxCents,
          totalCents,
          manualPaymentNote: body.note?.trim() || null,
          campaignId: campaign.id,
          items: {
            create: orderItems,
          },
        },
      })
      return created
    })

    // Best-effort CRM dedupe. Don't fail checkout if it hiccups.
    try {
      await upsertCustomerFromOrder(order)
    } catch (err) {
      console.error(`[crm] upsert for party order ${order.id} failed:`, err)
    }

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
    })
  } catch (err) {
    console.error('Party checkout error:', err)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    )
  }
}
