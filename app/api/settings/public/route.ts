import { NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

// Public read-only subset of SM_Settings for the storefront to consume.
// Only returns fields that are safe to expose to any visitor.
export async function GET() {
  const settings = await prisma.sM_Settings.findFirst({
    where: { id: 'singleton' },
    select: {
      venmoHandle: true,
      cashAppTag: true,
      paymentInstructions: true,
    },
  })
  return NextResponse.json({
    venmoHandle: settings?.venmoHandle ?? '',
    cashAppTag: settings?.cashAppTag ?? '',
    paymentInstructions: settings?.paymentInstructions ?? '',
  })
}
