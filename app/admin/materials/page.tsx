import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import MaterialManager from './MaterialManager'

export const dynamic = 'force-dynamic'

export default async function MaterialsPage() {
  await requireAdmin()

  const materials = await prisma.sM_Material.findMany({
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-6">
        Materials
      </h1>
      <MaterialManager initialMaterials={materials} />
    </div>
  )
}
