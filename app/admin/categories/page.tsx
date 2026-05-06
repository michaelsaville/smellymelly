import { prisma } from '@/app/lib/prisma'
import { CategoryBoard } from './CategoryBoard'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const cats = await prisma.sM_Category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true } } },
  })

  const initial = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    baseIngredients: c.baseIngredients,
    iconEmoji: c.iconEmoji,
    iconImageUrl: c.iconImageUrl,
    productCount: c._count.products,
  }))

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-dark">
            Categories
          </h1>
          <p className="mt-1 text-sm text-brand-brown/60">
            Drag tiles to reorder how categories appear on{' '}
            <a href="/shop" className="underline hover:text-brand-terra">
              /shop
            </a>
            . Click Edit to rename, change the URL slug, or update base
            ingredients.
          </p>
        </div>
      </div>

      <CategoryBoard initial={initial} />
    </div>
  )
}
