import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { materialItemCost } from '@/app/lib/units'

export const dynamic = 'force-dynamic'

export default async function RecipesPage() {
  await requireAdmin()

  const recipes = await prisma.sM_Recipe.findMany({
    include: {
      product: { select: { id: true, name: true } },
      items: { include: { material: true } },
    },
    orderBy: { name: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          Recipes
        </h1>
        <Link href="/admin/recipes/new" className="btn-primary text-sm">
          + New Recipe
        </Link>
      </div>

      <p className="text-sm text-brand-brown/60 mb-6">
        Each recipe calculates the exact cost to make a product based on materials used.
      </p>

      {recipes.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-brand-brown/50 mb-4">
            No recipes yet. Add your materials first, then create recipes.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/admin/materials" className="btn-ghost text-sm">
              Manage Materials
            </Link>
            <Link href="/admin/recipes/new" className="btn-primary text-sm">
              Create First Recipe
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => {
            // Calculate batch cost
            let batchCostCents = 0
            let conversionError = false
            for (const item of recipe.items) {
              try {
                batchCostCents += materialItemCost(
                  item.material.packageCostCents,
                  item.material.packageSize,
                  item.material.packageUnit,
                  item.quantity,
                  item.unit,
                )
              } catch {
                conversionError = true
              }
            }
            const perUnitCents = recipe.yields > 0 ? batchCostCents / recipe.yields : batchCostCents

            return (
              <Link
                key={recipe.id}
                href={`/admin/recipes/${recipe.id}`}
                className="card hover:shadow-md transition-shadow"
              >
                <h3 className="font-display font-semibold text-brand-dark mb-1">
                  {recipe.name}
                </h3>
                {recipe.product && (
                  <p className="text-xs text-brand-terra mb-2">
                    Linked to: {recipe.product.name}
                  </p>
                )}
                <div className="flex items-baseline gap-4 mt-3">
                  <div>
                    <p className="text-xs text-brand-brown/50 uppercase tracking-wide">
                      Batch Cost
                    </p>
                    <p className="text-lg font-bold text-brand-dark">
                      {conversionError ? '—' : `$${(batchCostCents / 100).toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-brown/50 uppercase tracking-wide">
                      Per Unit ({recipe.yields} yield{recipe.yields !== 1 ? 's' : ''})
                    </p>
                    <p className="text-lg font-bold text-brand-terra">
                      {conversionError ? '—' : `$${(perUnitCents / 100).toFixed(2)}`}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-brand-brown/40 mt-2">
                  {recipe.items.length} material{recipe.items.length !== 1 ? 's' : ''}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
