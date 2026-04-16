import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import RecipeForm from '../RecipeForm'

export const dynamic = 'force-dynamic'

export default async function NewRecipePage() {
  await requireAdmin()

  const [materials, products] = await Promise.all([
    prisma.sM_Material.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.sM_Product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          New Recipe
        </h1>
        <a href="/admin/recipes" className="btn-ghost text-sm">
          &larr; Back to Recipes
        </a>
      </div>

      <RecipeForm materials={materials} products={products} />
    </div>
  )
}
