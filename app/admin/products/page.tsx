import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  await requireAdmin()

  const products = await prisma.sM_Product.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      category: { select: { name: true } },
      variants: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          priceCents: true,
          stockQuantity: true,
          isActive: true,
        },
      },
      _count: { select: { variants: true } },
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          Products
        </h1>
        <Link href="/admin/products/new" className="btn-primary">
          + Add Product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-brand-brown/60">No products yet.</p>
          <Link href="/admin/products/new" className="btn-primary mt-4 inline-block">
            Add Your First Product
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const priceRange = p.variants.length
              ? {
                  min: Math.min(...p.variants.map((v) => v.priceCents)),
                  max: Math.max(...p.variants.map((v) => v.priceCents)),
                }
              : null
            const totalStock = p.variants.reduce(
              (s, v) => s + v.stockQuantity,
              0,
            )

            return (
              <Link
                key={p.id}
                href={`/admin/products/${p.id}`}
                className={`card flex items-center gap-4 hover:border-brand-terra/40 hover:shadow-md transition-all ${
                  !p.isActive ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-semibold text-brand-dark truncate">
                      {p.name}
                    </h3>
                    {!p.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        Inactive
                      </span>
                    )}
                    {p.isFeatured && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        Featured
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-brand-brown/60">
                    <span>{p.category.name}</span>
                    {p.scent && <span>· {p.scent}</span>}
                    <span>· {p._count.variants} variant{p._count.variants !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-none text-sm">
                  <div className="text-right">
                    <div className="font-medium text-brand-dark">
                      {priceRange
                        ? priceRange.min === priceRange.max
                          ? `$${(priceRange.min / 100).toFixed(2)}`
                          : `$${(priceRange.min / 100).toFixed(2)} – $${(priceRange.max / 100).toFixed(2)}`
                        : '—'}
                    </div>
                    <div className="text-xs text-brand-brown/40">price</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${totalStock <= 5 ? 'text-red-600' : 'text-brand-dark'}`}>
                      {totalStock}
                    </div>
                    <div className="text-xs text-brand-brown/40">in stock</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
