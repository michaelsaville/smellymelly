import { redirect } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import RecipeForm from '../RecipeForm'
import MakeBatchPanel from './MakeBatchPanel'

export const dynamic = 'force-dynamic'

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [recipe, materials, products] = await Promise.all([
    prisma.sM_Recipe.findUnique({
      where: { id },
      include: {
        items: true,
        product: {
          select: {
            name: true,
            variants: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true, stockQuantity: true },
            },
          },
        },
      },
    }),
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

  if (!recipe) redirect('/admin/recipes')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          Edit: {recipe.name}
        </h1>
        <a href="/admin/recipes" className="btn-ghost text-sm">
          &larr; Back to Recipes
        </a>
      </div>

      <MakeBatchPanel
        recipeId={recipe.id}
        yields={recipe.yields}
        productName={recipe.product?.name ?? null}
        variants={recipe.product?.variants ?? []}
      />

      <RecipeForm
        materials={materials}
        products={products}
        initial={{
          id: recipe.id,
          name: recipe.name,
          productId: recipe.productId,
          yields: recipe.yields,
          notes: recipe.notes,
          items: recipe.items.map((i) => ({
            materialId: i.materialId,
            quantity: i.quantity,
            unit: i.unit,
          })),
        }}
      />
    </div>
  )
}
