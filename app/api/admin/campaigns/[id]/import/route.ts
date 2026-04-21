import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { upsertCustomerFromOrder } from '@/app/lib/customers'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface ImportBuyer {
  name: string
  phone?: string | null
  email?: string | null
  notes?: string | null
  items: Array<{ variantId: string; quantity: number }>
}

interface ImportBody {
  buyers: ImportBuyer[]
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const body = (await req.json()) as ImportBody
  if (!Array.isArray(body.buyers) || body.buyers.length === 0) {
    return NextResponse.json(
      { error: 'At least one buyer is required.' },
      { status: 400 },
    )
  }

  const campaign = await prisma.sM_Campaign.findUnique({
    where: { id },
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
    return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  const allowedVariantIds = new Set(campaign.variants.map((cv) => cv.variantId))
  const variantLookup = new Map(
    campaign.variants.map((cv) => [cv.variantId, cv.variant]),
  )

  // Validate every buyer has a name and at least one item.
  for (const [idx, buyer] of body.buyers.entries()) {
    if (!buyer.name?.trim()) {
      return NextResponse.json(
        { error: `Buyer #${idx + 1} needs a name.` },
        { status: 400 },
      )
    }
    if (!buyer.items?.length) {
      return NextResponse.json(
        { error: `Buyer "${buyer.name}" has no items.` },
        { status: 400 },
      )
    }
    for (const item of buyer.items) {
      if (!allowedVariantIds.has(item.variantId)) {
        return NextResponse.json(
          { error: `Buyer "${buyer.name}" has an item not on this campaign.` },
          { status: 400 },
        )
      }
      if (!Number.isFinite(item.quantity) || item.quantity < 1) {
        return NextResponse.json(
          { error: `Buyer "${buyer.name}" has an invalid quantity.` },
          { status: 400 },
        )
      }
    }
  }

  // Aggregate demand across all buyers per variant and verify stock.
  const demand = new Map<string, number>()
  for (const buyer of body.buyers) {
    for (const item of buyer.items) {
      demand.set(item.variantId, (demand.get(item.variantId) ?? 0) + item.quantity)
    }
  }
  for (const [variantId, qty] of demand) {
    const variant = variantLookup.get(variantId)!
    if (variant.stockQuantity < qty) {
      return NextResponse.json(
        {
          error: `Not enough stock for "${variant.name}" — need ${qty}, have ${variant.stockQuantity}.`,
        },
        { status: 400 },
      )
    }
  }

  const unitCents = campaign.customerPriceCents

  // Transaction: decrement stock, then insert one order per buyer.
  const createdIds: string[] = []
  await prisma.$transaction(async (tx) => {
    for (const [variantId, qty] of demand) {
      await tx.sM_ProductVariant.update({
        where: { id: variantId },
        data: { stockQuantity: { decrement: qty } },
      })
    }

    for (const buyer of body.buyers) {
      const name = buyer.name.trim()
      const phoneDigits = (buyer.phone ?? '').replace(/\D/g, '')
      // Synthetic placeholder email if none written. Stable on phone when
      // available so re-scans from the same drive dedupe cleanly.
      const emailBase = (buyer.email ?? '').trim().toLowerCase()
      const email =
        emailBase ||
        `paper-${phoneDigits || Date.now().toString(36)}@smellymelly.local`

      const orderItems = buyer.items.map((item) => {
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

      const created = await tx.sM_Order.create({
        data: {
          status: 'PENDING',
          fulfillment: 'HOST_DELIVERY',
          paymentMethod: 'MANUAL',
          customerName: name,
          customerEmail: email,
          customerPhone: buyer.phone?.trim() || null,
          subtotalCents,
          shippingCents: 0,
          taxCents: 0,
          totalCents: subtotalCents,
          manualPaymentNote: buyer.notes?.trim() || null,
          campaignId: campaign.id,
          items: { create: orderItems },
        },
      })
      createdIds.push(created.id)
    }
  })

  // Best-effort CRM upsert per created order. Failures don't roll back — the
  // orders were already committed and stock adjusted.
  for (const id of createdIds) {
    try {
      const order = await prisma.sM_Order.findUnique({ where: { id } })
      if (order) await upsertCustomerFromOrder(order)
    } catch (err) {
      console.error(`[campaigns/import] CRM upsert for ${id} failed:`, err)
    }
  }

  return NextResponse.json({
    createdCount: createdIds.length,
    createdIds,
  })
}
