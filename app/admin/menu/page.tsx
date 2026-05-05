import { prisma } from '@/app/lib/prisma'
import { MenuBoard } from './MenuBoard'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const [groups, allScents] = await Promise.all([
    prisma.sM_MenuGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        scentLinks: {
          orderBy: { sortOrder: 'asc' },
          include: { scent: true },
        },
      },
    }),
    prisma.sM_Scent.findMany({ orderBy: { name: 'asc' } }),
  ])

  const initialGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    displayLabel: g.displayLabel,
    priceLabel: g.priceLabel,
    theme: g.theme,
    sortOrder: g.sortOrder,
    isActive: g.isActive,
    scents: g.scentLinks.map((l) => ({ id: l.scent.id, name: l.scent.name })),
  }))

  const initialScents = allScents.map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.isActive,
  }))

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-dark">
            Scent Menu
          </h1>
          <p className="mt-1 text-sm text-brand-brown/60">
            Drag scents into the cards below. This is what shows on{' '}
            <a href="/menu" className="underline hover:text-brand-terra">
              /menu
            </a>{' '}
            and on the printable handout.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <a
            href="/admin/menu/layout"
            className="btn-primary whitespace-nowrap"
          >
            Layout preview →
          </a>
          <a
            href="/menu/print"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand-brown/60 underline hover:text-brand-terra"
          >
            Open print page
          </a>
        </div>
      </div>

      <MenuBoard initialGroups={initialGroups} initialScents={initialScents} />
    </div>
  )
}
