import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'
import StoreLayout from '@/app/components/StoreLayout'

export const dynamic = 'force-dynamic'

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const categoryEmojis: Record<string, string> = {
  candles: '🕯️',
  soaps: '🧼',
  'bath-bombs': '🛁',
  'lip-balm': '💋',
  'beard-balm': '🧔',
}

export default async function HomePage() {
  const [categories, featuredProducts] = await Promise.all([
    prisma.sM_Category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.sM_Product.findMany({
      where: { isActive: true, isFeatured: true },
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
      take: 8,
    }),
  ])

  return (
    <StoreLayout>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-cream to-surface-warm py-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-5xl font-bold text-brand-dark leading-tight sm:text-6xl">
            Handcrafted with love,
            <br />
            <span className="text-brand-terra">scented with joy</span>
          </h1>
          <p className="mt-6 text-lg text-brand-brown/70 max-w-xl mx-auto">
            Small-batch candles, soaps, bath bombs, and body care products —
            made by hand in West Virginia.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/shop" className="btn-primary text-base px-8 py-3">
              Shop Now
            </Link>
            <Link href="/about" className="btn-secondary text-base px-8 py-3">
              Our Story
            </Link>
          </div>
        </div>
      </section>

      {/* Categories Preview */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-bold text-brand-dark text-center">
            What We Make
          </h2>
          <p className="mt-3 text-center text-brand-brown/60">
            Everything handmade, everything with heart
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/shop?category=${cat.slug}`}
                className="card text-center hover:border-brand-terra/40 hover:shadow-md transition-all group"
              >
                <div className="text-4xl mb-3">
                  {categoryEmojis[cat.slug] || '✨'}
                </div>
                <div className="font-display text-lg font-semibold text-brand-dark group-hover:text-brand-terra transition-colors">
                  {cat.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="py-20 px-6 bg-brand-cream/50">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-display text-3xl font-bold text-brand-dark text-center">
              Featured Products
            </h2>
            <p className="mt-3 text-center text-brand-brown/60">
              Hand-picked favorites from our collection
            </p>

            <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {featuredProducts.map((product) => {
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
                            {categoryEmojis[product.category?.slug ?? ''] || '✨'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-display text-base font-semibold text-brand-dark group-hover:text-brand-terra transition-colors line-clamp-1">
                        {product.name}
                      </h3>
                      {product.scent && (
                        <p className="mt-0.5 text-xs text-brand-brown/60">{product.scent}</p>
                      )}
                      <div className="mt-2 text-sm font-medium text-brand-terra">
                        {minPrice !== null ? (
                          minPrice === maxPrice
                            ? formatPrice(minPrice)
                            : `From ${formatPrice(minPrice)}`
                        ) : (
                          'Price TBD'
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-10 text-center">
              <Link href="/shop" className="btn-secondary">
                View All Products
              </Link>
            </div>
          </div>
        </section>
      )}
    </StoreLayout>
  )
}
