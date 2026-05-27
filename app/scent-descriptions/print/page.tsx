import type { Metadata } from 'next'
import { prisma } from '@/app/lib/prisma'
import { ScentDescriptions } from '../ScentDescriptions'
import { ScentDescriptionsPrintShell } from './PrintShell'
import '../sheet.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Print Scent Descriptions',
}

export default async function ScentDescriptionsPrintPage() {
  const [scents, settings] = await Promise.all([
    prisma.sM_Scent.findMany({
      // Only scents that are active AND ticked for the printed sheet.
      // Unticking "Print" in /admin/scents/descriptions drops a duplicate
      // or out-of-stock scent from this document without disabling it.
      where: { isActive: true, onDescriptionSheet: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
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

  // Portrait per the SM admin-tool pattern: sheet-style lists fit more
  // rows when taller-than-wide.
  return (
    <ScentDescriptionsPrintShell orientation="PORTRAIT">
      <ScentDescriptions
        scents={scents}
        storeName={settings?.businessName || "Smelly Melly's"}
        phone={settings?.businessPhone}
        email={settings?.businessEmail}
        social="@SmellyMellys"
      />
    </ScentDescriptionsPrintShell>
  )
}
