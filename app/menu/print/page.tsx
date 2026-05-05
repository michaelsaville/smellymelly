import type { Metadata } from 'next'
import { prisma } from '@/app/lib/prisma'
import { MenuCards } from '../MenuCards'
import { PrintShell } from './PrintShell'
import '../menu.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Print Menu',
}

export default async function MenuPrintPage() {
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
      select: {
        businessName: true,
        businessEmail: true,
        businessPhone: true,
        menuOrientation: true,
      },
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

  const orientation =
    settings?.menuOrientation === 'PORTRAIT' ? 'PORTRAIT' : 'LANDSCAPE'

  return (
    <PrintShell orientation={orientation}>
      <MenuCards
        groups={groupData}
        storeName={settings?.businessName || "Smelly Melly's"}
        phone={settings?.businessPhone}
        email={settings?.businessEmail}
        social="@SmellyMellys"
      />
    </PrintShell>
  )
}
