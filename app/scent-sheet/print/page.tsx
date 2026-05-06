import type { Metadata } from 'next'
import { prisma } from '@/app/lib/prisma'
import { ScentSheet } from '../ScentSheet'
import { ScentSheetPrintShell } from './PrintShell'
import '../sheet.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Print Scent Sheet',
}

export default async function ScentSheetPrintPage() {
  const [scents, categories, settings] = await Promise.all([
    prisma.sM_Scent.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        categoryLinks: { select: { categoryId: true } },
      },
    }),
    prisma.sM_Category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        iconEmoji: true,
        iconImageUrl: true,
        iconSheetEmoji: true,
        iconSheetImageUrl: true,
      },
    }),
    prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
      select: {
        businessName: true,
        businessEmail: true,
        businessPhone: true,
      },
    }),
  ])

  // The scent sheet defaults to PORTRAIT — it's a tall list, taller-
  // than-wide tends to fit more rows per page. If Mel ever wants
  // landscape on the sheet, add a separate setting (don't share
  // SM_Settings.menuOrientation; the menu and sheet are different
  // documents).
  return (
    <ScentSheetPrintShell orientation="PORTRAIT">
      <ScentSheet
        scents={scents.map((s) => ({
          id: s.id,
          name: s.name,
          categoryIds: s.categoryLinks.map((l) => l.categoryId),
        }))}
        categories={categories.map((c) => {
          // Sheet-specific icons take priority over the website icons.
          const image = c.iconSheetImageUrl || c.iconImageUrl
          const emoji = c.iconSheetEmoji || c.iconEmoji
          return {
            id: c.id,
            name: c.name,
            icon: image || emoji || '·',
            isImage: !!image,
          }
        })}
        storeName={settings?.businessName || "Smelly Melly's"}
        phone={settings?.businessPhone}
        email={settings?.businessEmail}
        social="@SmellyMellys"
      />
    </ScentSheetPrintShell>
  )
}
