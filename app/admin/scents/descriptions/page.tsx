import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'
import { ScentDescriptionsManager } from './ScentDescriptionsManager'

export const dynamic = 'force-dynamic'

/**
 * Admin: scent descriptions paper-form builder. Lists every active scent
 * with an editable description (AI pre-fills, Mel can edit). Sibling to
 * /admin/scents/sheet — same admin-tool pattern (alphabetical default,
 * search filter, per-row inline save, sibling print page).
 */
export default async function ScentDescriptionsAdminPage() {
  const scents = await prisma.sM_Scent.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      onDescriptionSheet: true,
      updatedAt: true,
    },
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
            Scent Descriptions
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-brand-brown/60">
            Customer-facing one-paragraph descriptions for the printable
            paper form. AI pre-fills empty rows; you can edit any of them
            and the change saves automatically. Per-row{' '}
            <em>Regenerate</em> re-rolls a single description. Untick{' '}
            <em>Print</em> to drop a scent from the printed sheet (e.g. a
            duplicate or one that&apos;s out of stock) without removing it.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row">
          <a
            href="/scent-descriptions/print"
            target="_blank"
            rel="noreferrer"
            className="btn-secondary whitespace-nowrap"
          >
            Print plain sheet →
          </a>
          <a
            href="/scent-menu/print"
            target="_blank"
            rel="noreferrer"
            className="btn-primary whitespace-nowrap"
          >
            Print menu style →
          </a>
        </div>
      </div>

      <ScentDescriptionsManager
        initialScents={scents.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description ?? '',
          onDescriptionSheet: s.onDescriptionSheet,
          updatedAt: s.updatedAt.toISOString(),
        }))}
      />
    </div>
  )
}
