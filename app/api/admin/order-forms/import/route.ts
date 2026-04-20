import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { upsertCustomerFromOrder } from '@/app/lib/customers'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface ImportBody {
  // Either pick an existing customer …
  existingCustomerId?: string | null
  // … or provide inline customer fields (email may be synthetic for paper orders).
  customer: {
    name: string
    email: string
    phone?: string | null
  }
  items: Array<{ variantId: string; quantity: number }>
  notes?: string | null
  manualPaymentNote?: string | null
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as ImportBody

  if (!body.customer?.name?.trim()) {
    return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 })
  }
  if (!body.items?.length) {
    return NextResponse.json({ error: 'At least one line item is required.' }, { status: 400 })
  }

  // Resolve email. If an existing customer was picked, use that row's email to
  // preserve the CRM link. Otherwise use what was submitted; synthesize one if
  // missing so the Order's required customerEmail field is satisfied.
  let email = body.customer.email?.trim().toLowerCase() || ''
  let name = body.customer.name.trim()
  let phone: string | null = body.customer.phone?.trim() || null

  if (body.existingCustomerId) {
    const existing = await prisma.sM_Customer.findUnique({
      where: { id: body.existingCustomerId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Selected customer no longer exists.' }, { status: 400 })
    }
    email = existing.email
    // Prefer the newly-written info but fall back to existing values.
    if (!name) name = existing.name
    if (!phone) phone = existing.phone
  } else if (!email) {
    // Paper-order placeholder email — stable by phone if we have one.
    const phoneDigits = (phone ?? '').replace(/\D/g, '')
    const suffix = phoneDigits || `unknown-${Date.now()}`
    email = `paper+${suffix}@paperorder.smellymelly.local`
  }

  // Load variants and verify stock
  const variantIds = body.items.map((i) => i.variantId)
  const variants = await prisma.sM_ProductVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: { product: true },
  })
  const variantMap = new Map(variants.map((v) => [v.id, v]))

  for (const item of body.items) {
    const v = variantMap.get(item.variantId)
    if (!v) {
      return NextResponse.json(
        { error: `Variant no longer available: ${item.variantId}` },
        { status: 400 },
      )
    }
    if (item.quantity < 1) {
      return NextResponse.json({ error: 'Quantity must be at least 1.' }, { status: 400 })
    }
    if (v.stockQuantity < item.quantity) {
      return NextResponse.json(
        {
          error: `Not enough stock for "${v.product.name} — ${v.name}". Available: ${v.stockQuantity}, requested: ${item.quantity}`,
        },
        { status: 400 },
      )
    }
  }

  // Wholesale discount if the customer has one on file.
  const existingCustomer = await prisma.sM_Customer.findUnique({
    where: { email },
    select: { wholesaleDiscountPct: true },
  })
  const wholesalePct = existingCustomer?.wholesaleDiscountPct ?? 0

  const settings = await prisma.sM_Settings.findFirst({ where: { id: 'singleton' } })
  const taxRate = settings?.taxRate ?? 0.06

  const orderItems = body.items.map((item) => {
    const v = variantMap.get(item.variantId)!
    return {
      variantId: v.id,
      productName: v.product.name,
      variantName: v.name,
      quantity: item.quantity,
      unitCents: v.priceCents,
      totalCents: v.priceCents * item.quantity,
    }
  })

  const rawSubtotal = orderItems.reduce((s, i) => s + i.totalCents, 0)
  const discount = Math.round((rawSubtotal * wholesalePct) / 100)
  const subtotalCents = rawSubtotal - discount
  const shippingCents = 0 // paper drop-off is always PICKUP
  const taxCents = Math.round(subtotalCents * taxRate)
  const totalCents = subtotalCents + shippingCents + taxCents

  const order = await prisma.$transaction(async (tx) => {
    for (const item of body.items) {
      await tx.sM_ProductVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { decrement: item.quantity } },
      })
    }

    return tx.sM_Order.create({
      data: {
        status: 'PENDING',
        fulfillment: 'PICKUP',
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        paymentMethod: 'MANUAL',
        manualPaymentNote: body.manualPaymentNote?.trim() || 'Paper order form',
        items: {
          create: orderItems,
        },
      },
    })
  })

  try {
    await upsertCustomerFromOrder(order)
  } catch (err) {
    console.error(`[order-forms/import] upsert for order ${order.id} failed:`, err)
  }

  // Stash notes in the customer row (non-destructive append) if provided.
  if (body.notes?.trim()) {
    try {
      const customer = await prisma.sM_Customer.findUnique({
        where: { email },
        select: { id: true, notes: true },
      })
      if (customer) {
        const date = new Date().toISOString().slice(0, 10)
        const entry = `[${date}] Paper order #${order.orderNumber}: ${body.notes.trim()}`
        const newNotes = customer.notes ? `${customer.notes}\n${entry}` : entry
        await prisma.sM_Customer.update({
          where: { id: customer.id },
          data: { notes: newNotes },
        })
      }
    } catch (err) {
      console.error('[order-forms/import] note append failed:', err)
    }
  }

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
  })
}
