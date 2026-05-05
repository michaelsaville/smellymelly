import type { Metadata } from 'next'
import StoreLayout from '@/app/components/StoreLayout'
import { prisma } from '@/app/lib/prisma'
import { MenuCards } from './MenuCards'
import './menu.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Scent Menu',
  description:
    'The current scent menu for Smelly Melly handcrafted bath & body products.',
}

export default async function MenuPage() {
  const [groups, settings] = await Promise.all([
    prisma.sM_MenuGroup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        scentLinks: {
          orderBy: { sortOrder: 'asc' },
          include: { scent: true },
        },
      },
    }),
    prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
      select: { businessName: true, businessEmail: true, businessPhone: true },
    }),
  ])

  const groupData = groups.map((g) => ({
    id: g.id,
    name: g.name,
    displayLabel: g.displayLabel,
    priceLabel: g.priceLabel,
    theme: g.theme,
    fullWidth: g.fullWidth,
    scents: g.scentLinks
      .filter((l) => l.scent.isActive)
      .map((l) => ({ id: l.scent.id, name: l.scent.name })),
  }))

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <MenuCards
          groups={groupData}
          storeName={settings?.businessName || "Smelly Melly's"}
          phone={settings?.businessPhone}
          email={settings?.businessEmail}
          social="@SmellyMellys"
        />
      </div>
    </StoreLayout>
  )
}
