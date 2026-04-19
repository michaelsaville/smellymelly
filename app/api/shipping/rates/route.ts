import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { getEasyPostClient, getFromAddress, isEasyPostConfigured } from '@/app/lib/easypost'

const FLAT_RATE_CENTS = 599

interface RateRequest {
  toAddress: {
    street1: string
    city: string
    state: string
    zip: string
  }
  items: Array<{ variantId: string; quantity: number }>
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RateRequest

  // If EasyPost isn't configured, return flat rate
  if (!isEasyPostConfigured()) {
    return NextResponse.json({
      rates: [
        {
          id: 'flat',
          carrier: 'Standard',
          service: 'Flat Rate',
          rateCents: FLAT_RATE_CENTS,
          deliveryDays: null,
        },
      ],
    })
  }

  // Validate address
  const to = body.toAddress
  if (!to?.street1 || !to?.city || !to?.state || !to?.zip) {
    return NextResponse.json({ error: 'Complete address is required' }, { status: 400 })
  }

  // Calculate total weight from variants
  const variantIds = body.items.map((i) => i.variantId)
  const variants = await prisma.sM_ProductVariant.findMany({
    where: { id: { in: variantIds } },
  })
  const variantMap = new Map(variants.map((v) => [v.id, v]))

  let totalWeightOz = 0
  for (const item of body.items) {
    const variant = variantMap.get(item.variantId)
    if (variant?.weightOz) {
      totalWeightOz += variant.weightOz * item.quantity
    }
  }

  // Minimum weight 4oz (for packaging)
  if (totalWeightOz < 4) totalWeightOz = 4

  try {
    const easypost = getEasyPostClient()

    const shipment = await easypost.Shipment.create({
      fromAddress: getFromAddress(),
      toAddress: {
        street1: to.street1,
        city: to.city,
        state: to.state,
        zip: to.zip,
        country: 'US',
      },
      parcel: {
        weight: totalWeightOz,
      },
    })

    // Filter to USPS rates and sort by price
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRates: any[] = shipment.rates || []
    const uspsRates = allRates
      .filter((r: { carrier: string }) => r.carrier === 'USPS')
      .sort((a: { rate: string }, b: { rate: string }) => parseFloat(a.rate) - parseFloat(b.rate))

    if (uspsRates.length === 0) {
      // Fallback to flat rate if no USPS rates available
      return NextResponse.json({
        rates: [
          {
            id: 'flat',
            carrier: 'Standard',
            service: 'Flat Rate',
            rateCents: FLAT_RATE_CENTS,
            deliveryDays: null,
          },
        ],
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rates = uspsRates.map((r: any) => ({
      id: r.id,
      carrier: r.carrier,
      service: r.service,
      rateCents: Math.round(parseFloat(r.rate) * 100),
      deliveryDays: r.deliveryDays ?? null,
      shipmentId: shipment.id,
    }))

    return NextResponse.json({ rates })
  } catch (err) {
    console.error('EasyPost rate error:', err)
    // Fallback to flat rate
    return NextResponse.json({
      rates: [
        {
          id: 'flat',
          carrier: 'Standard',
          service: 'Flat Rate',
          rateCents: FLAT_RATE_CENTS,
          deliveryDays: null,
        },
      ],
    })
  }
}
