import { NextRequest, NextResponse } from 'next/server'
import { computeCheckout } from '@/app/lib/checkout-totals'

interface Body {
  code?: string
  email?: string
  items?: { variantId: string; quantity: number }[]
}

/**
 * Previews a promo code against the current cart for the checkout "Apply"
 * button. Runs the same computeCheckout math as the real charge (fulfillment
 * forced to PICKUP so shipping is out of the picture), so the discount shown
 * here is exactly what will be applied. Returns the reason on rejection.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const code = body.code?.trim()
    if (!code) {
      return NextResponse.json({ ok: false, error: 'Enter a promo code.' }, { status: 400 })
    }
    if (!body.items?.length) {
      return NextResponse.json({ ok: false, error: 'Your cart is empty.' }, { status: 400 })
    }

    const computed = await computeCheckout({
      items: body.items,
      fulfillment: 'PICKUP',
      email: body.email?.trim() || 'guest@example.com',
      discountCode: code,
    })
    if (!computed.ok) {
      return NextResponse.json({ ok: false, error: computed.error }, { status: 400 })
    }

    const { discountCents, discountCode } = computed.data
    return NextResponse.json({ ok: true, code: discountCode, discountCents })
  } catch (err) {
    console.error('validate-code error:', err)
    return NextResponse.json({ ok: false, error: 'Could not check that code.' }, { status: 500 })
  }
}
