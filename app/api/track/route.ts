import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

// Public order lookup. Requires BOTH order number and the matching email so
// order numbers (sequential) can't be enumerated by strangers.
export async function POST(req: NextRequest) {
  let body: { orderNumber?: string | number; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const orderNumber = parseInt(String(body.orderNumber ?? '').replace(/^#/, '').trim(), 10)
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!orderNumber || !email) {
    return NextResponse.json({ error: 'Enter your order number and email.' }, { status: 400 })
  }

  const order = await prisma.sM_Order.findFirst({
    where: {
      orderNumber,
      customerEmail: { equals: email, mode: 'insensitive' },
    },
    include: { items: { select: { productName: true, variantName: true, quantity: true } } },
  })

  // Same response whether not-found or email-mismatch — don't leak which failed.
  if (!order) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      fulfillment: order.fulfillment,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      trackingNumber: order.trackingNumber,
      totalCents: order.totalCents,
      customerName: order.customerName,
      items: order.items,
    },
  })
}
