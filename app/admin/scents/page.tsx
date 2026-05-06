import { prisma } from '@/app/lib/prisma'
import { ScentManager } from './ScentManager'

export const dynamic = 'force-dynamic'

export default async function ScentsPage() {
  const scents = await prisma.sM_Scent.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-dark">
            Scents
          </h1>
          <p className="mt-1 text-sm text-brand-brown/60">
            Manage your scent options. When creating a product, you can
            generate one variant per scent automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/admin/scents/descriptions"
            className="rounded-md border border-brand-warm bg-white px-3 py-1.5 text-sm font-medium text-brand-dark hover:border-brand-terra"
          >
            Scent descriptions →
          </a>
          <a
            href="/admin/scents/sheet"
            className="btn-primary whitespace-nowrap"
          >
            Scent sheet →
          </a>
        </div>
      </div>
      <ScentManager initialScents={scents} />
    </div>
  )
}
