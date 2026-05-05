import { prisma } from '@/app/lib/prisma'
import { LayoutPreview } from './LayoutPreview'
import '@/app/menu/menu.css'
import './preview.css'

export const dynamic = 'force-dynamic'

/**
 * Admin layout-preview for the printed scent menu. Mirrors what
 * /menu/print actually renders (US Letter landscape, 0.5" margins),
 * shows where page breaks fall, and lets Mel drag whole groups to
 * reorder until the breaks land cleanly. Saves back to
 * SM_MenuGroup.sortOrder via the existing PATCH route.
 *
 * Only active groups are previewed — matches /menu/print's filter.
 * Inactive groups stay visible/editable on /admin/menu (the scent
 * board) but don't affect pagination here.
 */
export default async function MenuLayoutPage() {
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
    scents: g.scentLinks
      .filter((l) => l.scent.isActive)
      .map((l) => ({ id: l.scent.id, name: l.scent.name })),
  }))

  return (
    <LayoutPreview
      groups={groupData}
      storeName={settings?.businessName || "Smelly Melly's"}
      phone={settings?.businessPhone}
      email={settings?.businessEmail}
    />
  )
}
