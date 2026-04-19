import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { getEasyPostClient, getFromAddress, isEasyPostConfigured } from '@/app/lib/easypost'
import { sendShippingNotification } from '@/app/lib/email'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isEasyPostConfigured()) {
    return NextResponse.json({ error: 'Shipping integration not configured' }, { status: 400 })
  }

  const body = (await req.json()) as { orderId: string; rateId?: string }
  if (!body.orderId) {
    return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
  }

  const order = await prisma.sM_Order.findUnique({
    where: { id: body.orderId },
    include: {
      items: { include: { variant: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  if (order.fulfillment !== 'SHIP') {
    return NextResponse.json({ error: 'Order is for pickup, not shipping' }, { status: 400 })
  }

  // Calculate total weight
  let totalWeightOz = 0
  for (const item of order.items) {
    if (item.variant.weightOz) {
      totalWeightOz += item.variant.weightOz * item.quantity
    }
  }
  if (totalWeightOz < 4) totalWeightOz = 4

  try {
    const easypost = getEasyPostClient()

    const shipment = await easypost.Shipment.create({
      fromAddress: getFromAddress(),
      toAddress: {
        name: order.shippingName || order.customerName,
        street1: order.shippingAddress!,
        city: order.shippingCity!,
        state: order.shippingState!,
        zip: order.shippingZip!,
        country: 'US',
      },
      parcel: {
        weight: totalWeightOz,
      },
    })

    // Buy the cheapest USPS rate or the specified rate
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRates: any[] = shipment.rates || []
    let selectedRate = allRates
      .filter((r: { carrier: string }) => r.carrier === 'USPS')
      .sort((a: { rate: string }, b: { rate: string }) => parseFloat(a.rate) - parseFloat(b.rate))[0]

    if (body.rateId) {
      selectedRate = allRates.find((r: { id: string }) => r.id === body.rateId) || selectedRate
    }

    if (!selectedRate) {
      return NextResponse.json({ error: 'No shipping rates available' }, { status: 400 })
    }

    const purchased = await easypost.Shipment.buy(shipment.id, selectedRate.id)

    // Update order with tracking info
    const updated = await prisma.sM_Order.update({
      where: { id: order.id },
      data: {
        trackingNumber: purchased.tracking_code || null,
        shippingLabel: purchased.postage_label?.label_url || null,
        status: 'SHIPPED',
        shippedAt: new Date(),
      },
      include: { items: true },
    })

    // Fire-and-forget shipping email. Mail failure must not fail label purchase.
    if (updated.trackingNumber) {
      sendShippingNotification(updated).catch((err) => {
        console.error(`[email] ship-notif for ${updated.id} failed:`, err)
      })
    }

    return NextResponse.json({
      trackingNumber: purchased.tracking_code,
      labelUrl: purchased.postage_label?.label_url,
      carrier: selectedRate.carrier,
      service: selectedRate.service,
    })
  } catch (err) {
    console.error('EasyPost label purchase error:', err)
    return NextResponse.json({ error: 'Failed to purchase shipping label' }, { status: 500 })
  }
}
