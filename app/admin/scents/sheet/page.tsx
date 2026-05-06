import { prisma } from '@/app/lib/prisma'
import Link from 'next/link'
import { ScentSheetEditor } from './ScentSheetEditor'
import { CategoryIconPicker } from './CategoryIconPicker'

export const dynamic = 'force-dynamic'

/**
 * Admin Scent Sheet builder. Two sections:
 *   1. Category icons — Mel can override the website icons with
 *      sheet-specific ones (sheet image > sheet emoji > website
 *      image > website emoji > "·" placeholder).
 *   2. Per-scent category chips — toggleable, marks SM_ScentCategory.
 *
 * Independent of menu-group membership — see SM_ScentCategory model.
 */
export default async function ScentSheetAdminPage() {
  const [scents, categories] = await Promise.all([
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
        slug: true,
        iconEmoji: true,
        iconImageUrl: true,
        iconSheetEmoji: true,
        iconSheetImageUrl: true,
      },
    }),
  ])

  const initial = scents.map((s) => ({
    id: s.id,
    name: s.name,
    categoryIds: s.categoryLinks.map((l) => l.categoryId),
  }))

  // Effective icon for chip rendering — sheet overrides win, website
  // icons are the fallback.
  const chipCategories = categories.map((c) => {
    const image = c.iconSheetImageUrl || c.iconImageUrl
    const emoji = c.iconSheetEmoji || c.iconEmoji
    return {
      id: c.id,
      name: c.name,
      icon: image || emoji || '·',
      isImage: !!image,
    }
  })

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/scents"
            className="text-xs text-brand-brown/60 hover:text-brand-terra"
          >
            ← back to scents
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-dark">
            Scent Sheet
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-brand-brown/60">
            Mark which categories each scent is available in, and pick
            sheet-specific icons. The chips here are{' '}
            <em>independent</em> of menu-group membership — toggling
            them won&apos;t change the cards on the public Scent Menu.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <a
            href="/scent-sheet/print"
            target="_blank"
            rel="noreferrer"
            className="btn-primary whitespace-nowrap"
          >
            Print scent sheet →
          </a>
          {categories.length === 0 && (
            <span className="text-xs text-amber-700">
              No categories yet — add some at{' '}
              <Link className="underline" href="/admin/categories">
                /admin/categories
              </Link>
              .
            </span>
          )}
        </div>
      </div>

      {categories.length > 0 && (
        <section className="relative mt-6 rounded-lg border border-brand-brown/15 bg-white">
          <header className="flex items-end justify-between gap-3 rounded-t-lg border-b border-brand-brown/10 bg-brand-cream/50 px-4 py-2">
            <div>
              <h2 className="text-sm font-semibold text-brand-dark">
                Category icons
              </h2>
              <p className="text-[11px] text-brand-brown/60">
                Sheet-specific icons override the website ones (kept
                separate so the storefront keeps its larger marketing
                images). Click an icon to pick from the visual library
                or upload a small PNG/SVG.
              </p>
            </div>
            <div className="hidden text-[10px] uppercase tracking-wider text-brand-brown/50 sm:flex sm:gap-3">
              <span className="w-9 text-center">Click to edit</span>
              <span className="w-12">Site</span>
            </div>
          </header>
          <div className="divide-y divide-brand-brown/5">
            {categories.map((c) => (
              <CategoryIconPicker key={c.id} category={c} />
            ))}
          </div>
        </section>
      )}

      <ScentSheetEditor scents={initial} categories={chipCategories} />
    </div>
  )
}
