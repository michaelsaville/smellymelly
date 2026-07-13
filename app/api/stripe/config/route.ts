import { NextResponse } from 'next/server'
import { getStripePublishableKey, isStripeConfigured } from '@/app/lib/stripe'

export async function GET() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ configured: false })
  }
  return NextResponse.json({
    configured: true,
    publishableKey: getStripePublishableKey(),
  })
}
