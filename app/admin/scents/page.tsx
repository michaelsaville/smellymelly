import { prisma } from '@/app/lib/prisma'
import { ScentManager } from './ScentManager'

export const dynamic = 'force-dynamic'

export default async function ScentsPage() {
  const scents = await prisma.sM_Scent.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-dark">
        Scents
      </h1>
      <p className="mt-1 text-sm text-brand-brown/60">
        Manage your scent options. When creating a product, you can generate one variant per scent automatically.
      </p>
      <ScentManager initialScents={scents} />
    </div>
  )
}
