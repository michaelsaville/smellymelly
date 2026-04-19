import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'
import StoreLayout from '@/app/components/StoreLayout'

export const metadata: Metadata = {
  title: 'Shop',
  description:
    'Browse our full lineup of handmade candles, soaps, bath bombs, lip balm, and beard balm — all crafted in small batches.',
}

export const dynamic = 'force-dynamic'

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const categorySlug = params.category

  const [categories, products] = await Promise.all([
    prisma.sM_Category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.sM_Product.findMany({
      where: {
        isActive: true,
        ...(categorySlug
          ? { category: { slug: categorySlug } }
          : {}),
      },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { priceCents: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <StoreLayout>
      <div className="py-12 px-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            Shop
          </h1>
          <p className="mt-3 text-center text-brand-brown/60">
            Browse our handmade collection
          </p>

          {/* Category filter pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/shop"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !categorySlug
                  ? 'bg-brand-terra text-white'
                  : 'bg-brand-warm/60 text-brand-brown hover:bg-brand-warm'
              }`}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/shop?category=${cat.slug}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  categorySlug === cat.slug
                    ? 'bg-brand-terra text-white'
                    : 'bg-brand-warm/60 text-brand-brown hover:bg-brand-warm'
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Product grid */}
          {products.length > 0 ? (
            <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => {
                const image = product.images[0]
                const prices = product.variants.map((v) => v.priceCents)
                const minPrice = prices.length > 0 ? Math.min(...prices) : null
                const maxPrice = prices.length > 0 ? Math.max(...prices) : null

                return (
                  <Link
                    key={product.id}
                    href={`/shop/${product.slug}`}
                    className="card p-0 overflow-hidden hover:border-brand-terra/40 hover:shadow-md transition-all group"
                  >
                    {/* Image */}
                    <div className="aspect-square relative bg-gradient-to-br from-brand-peach/30 to-brand-warm overflow-hidden">
                      {image ? (
                        <img
                          src={image.url}
                          alt={image.altText || product.name}
                          className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-4xl opacity-40">
                            {product.category?.name === 'Candles' ? '🕯️' :
                             product.category?.name === 'Soaps' ? '🧼' :
                             product.category?.name === 'Bath Bombs' ? '🛁' :
                             product.category?.name === 'Lip Balm' ? '💋' :
                             product.category?.name === 'Beard Balm' ? '🧔' : '✨'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-display text-base font-semibold text-brand-dark group-hover:text-brand-terra transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      {product.scent && (
                        <p className="mt-0.5 text-xs text-brand-brown/60">{product.scent}</p>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-brand-terra">
                          {minPrice !== null ? (
                            minPrice === maxPrice
                              ? formatPrice(minPrice)
                              : `From ${formatPrice(minPrice)}`
                          ) : (
                            'Price TBD'
                          )}
                        </span>
                        <span className="text-xs font-medium text-brand-brown/40 group-hover:text-brand-terra transition-colors">
                          View
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="mt-20 text-center">
              <div className="text-5xl mb-4">🌿</div>
              <h3 className="font-display text-xl font-semibold text-brand-dark">
                Nothing here yet
              </h3>
              <p className="mt-2 text-brand-brown/60">
                {categorySlug
                  ? 'No products in this category right now. Check back soon!'
                  : 'Our shop is being stocked with handmade goodness. Check back soon!'}
              </p>
              {categorySlug && (
                <Link href="/shop" className="btn-secondary mt-6 inline-flex">
                  View All Products
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </StoreLayout>
  )
}
