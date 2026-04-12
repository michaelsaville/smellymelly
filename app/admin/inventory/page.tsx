import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { InventoryTable } from './InventoryTable'

export const dynamic = 'force-dynamic'

export default async function InventoryPage() {
  await requireAdmin()

  const variants = await prisma.sM_ProductVariant.findMany({
    where: { isActive: true },
    orderBy: [{ stockQuantity: 'asc' }, { product: { name: 'asc' } }],
    include: {
      product: {
        select: { name: true, scent: true, category: { select: { name: true } } },
      },
    },
  })

  const totalItems = variants.reduce((s, v) => s + v.stockQuantity, 0)
  const lowStock = variants.filter((v) => v.stockQuantity <= v.lowStockAt).length
  const outOfStock = variants.filter((v) => v.stockQuantity === 0).length

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-6">
        Inventory
      </h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-brand-terra">{totalItems}</div>
          <div className="text-sm text-brand-brown/60">Total Items</div>
        </div>
        <div className={`card text-center ${lowStock > 0 ? 'border-amber-300 bg-amber-50' : ''}`}>
          <div className={`text-2xl font-bold ${lowStock > 0 ? 'text-amber-600' : 'text-brand-terra'}`}>
            {lowStock}
          </div>
          <div className="text-sm text-brand-brown/60">Low Stock</div>
        </div>
        <div className={`card text-center ${outOfStock > 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <div className={`text-2xl font-bold ${outOfStock > 0 ? 'text-red-600' : 'text-brand-terra'}`}>
            {outOfStock}
          </div>
          <div className="text-sm text-brand-brown/60">Out of Stock</div>
        </div>
      </div>

      <InventoryTable
        variants={variants.map((v) => ({
          id: v.id,
          productName: v.product.name,
          scent: v.product.scent,
          category: v.product.category.name,
          variantName: v.name,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          lowStockAt: v.lowStockAt,
          priceCents: v.priceCents,
          costCents: v.costCents,
        }))}
      />
    </div>
  )
}
