import type { Metadata } from 'next'
import { prisma } from '@/app/lib/prisma'
import { ScentMenu } from '../ScentMenu'
import { ScentMenuPrintShell } from './PrintShell'
import '../scent-menu.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Print Scent Menu',
}

export default async function ScentMenuPrintPage() {
  // Same source set as the plain descriptions sheet: active scents the
  // operator has ticked for print. The "Print" checkbox in
  // /admin/scents/descriptions curates both documents.
  const [scents, settings] = await Promise.all([
    prisma.sM_Scent.findMany({
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

  return (
    <ScentMenuPrintShell orientation="PORTRAIT">
      <ScentMenu
        scents={scents}
        storeName={settings?.businessName || "Smelly Melly's"}
        phone={settings?.businessPhone}
        email={settings?.businessEmail}
        social="@SmellyMellys"
      />
    </ScentMenuPrintShell>
  )
}
