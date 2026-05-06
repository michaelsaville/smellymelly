import { prisma } from '@/app/lib/prisma'
import Link from 'next/link'
import { ScentSheetEditor } from './ScentSheetEditor'

export const dynamic = 'force-dynamic'

/**
 * Admin Scent Sheet builder. List of every scent with toggleable
 * category chips per row. Independent of menu-group membership —
 * see SM_ScentCategory model comment.
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
      },
    }),
  ])

  const initial = scents.map((s) => ({
    id: s.id,
    name: s.name,
    categoryIds: s.categoryLinks.map((l) => l.categoryId),
  }))

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
            Mark which categories each scent is available in. The
            chips here are <em>independent</em> of menu-group
            membership — toggling them won&apos;t change the cards on
            the public Scent Menu. Used to print a one-page reference
            sheet of every scent + the icons of categories it works for.
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
              <Link
                className="underline"
                href="/admin/categories"
              >
                /admin/categories
              </Link>
              .
            </span>
          )}
        </div>
      </div>

      <ScentSheetEditor
        scents={initial}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.iconImageUrl || c.iconEmoji || '·',
          isImage: !!c.iconImageUrl,
        }))}
      />
    </div>
  )
}
