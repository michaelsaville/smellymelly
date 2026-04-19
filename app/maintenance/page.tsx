import type { Metadata } from 'next'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Be right back',
  description: 'Smelly Melly is tidying up. Check back soon.',
  robots: { index: false, follow: false },
}

export default async function MaintenancePage() {
  const settings = await prisma.sM_Settings
    .findFirst({ where: { id: 'singleton' } })
    .catch(() => null)
  const message =
    settings?.maintenanceMessage?.trim() ||
    "We're putting the finishing touches on some new scents. Back very soon — thanks for your patience!"

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-cream to-surface-warm flex items-center justify-center px-6 py-16">
      <div className="max-w-xl text-center">
        <div className="text-6xl mb-6">🧼</div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-brand-dark">
          Be right back
        </h1>
        <p className="mt-6 text-lg text-brand-brown/80 leading-relaxed">
          {message}
        </p>
        <p className="mt-10 text-sm text-brand-brown/50">
          — Mel
        </p>
      </div>
    </div>
  )
}
