import { NextResponse } from 'next/server'
import { getSquareAppId, getSquareLocationId, isSquareConfigured } from '@/app/lib/square'

export async function GET() {
  if (!isSquareConfigured()) {
    return NextResponse.json({ configured: false })
  }

  return NextResponse.json({
    configured: true,
    appId: getSquareAppId(),
    locationId: getSquareLocationId(),
    environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
  })
}
