import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'
import StoreLayout from '@/app/components/StoreLayout'
import ProductCard from '@/app/components/ProductCard'

export const metadata: Metadata = {
  title: 'Shop',
  description:
    'Browse our full lineup of handmade body butter, bath salts, body scrub, wax melts, room fragrance, and lip balm — all crafted in small batches.',
}

export const dynamic = 'force-dynamic'


export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>
}) {
  const params = await searchParams
  const categorySlug = params.category
  const q = (params.q ?? '').trim()
  const sort = params.sort ?? 'featured'

  const orderBy =
    sort === 'newest' ? [{ createdAt: 'desc' as const }]
    : sort === 'name' ? [{ name: 'asc' as const }]
    : [{ isFeatured: 'desc' as const }, { name: 'asc' as const }]

  const [categories, products] = await Promise.all([
    prisma.sM_Category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.sM_Product.findMany({
      where: {
        isActive: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
                { variants: { some: { name: { contains: q, mode: 'insensitive' as const } } } },
              ],
            }
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
      orderBy,
    }),
  ])

  const ratings = await prisma.sM_Review.groupBy({
    by: ['productId'],
    where: { isApproved: true, productId: { in: products.map((p) => p.id) } },
    _avg: { rating: true },
    _count: { _all: true },
  })
  const ratingMap = new Map(
    ratings.map((r) => [r.productId, { avg: r._avg.rating ?? 0, count: r._count._all }]),
  )

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
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  categorySlug === cat.slug
                    ? 'bg-brand-terra text-white'
                    : 'bg-brand-warm/60 text-brand-brown hover:bg-brand-warm'
                }`}
              >
                {cat.iconImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cat.iconImageUrl}
                    alt=""
                    className="h-4 w-4 rounded object-cover"
                  />
                ) : cat.iconEmoji ? (
                  <span aria-hidden>{cat.iconEmoji}</span>
                ) : null}
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Search + sort (one form, no JS required) */}
          <form method="GET" action="/shop" className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search scents & products…"
              className="input w-full sm:w-72"
              aria-label="Search products"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="text-sm text-brand-brown/70">Sort</label>
              <select id="sort" name="sort" defaultValue={sort} className="input">
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="name">Name A–Z</option>
              </select>
              <button type="submit" className="btn-secondary whitespace-nowrap">Apply</button>
            </div>
          </form>
          {q && (
            <p className="mt-3 text-center text-sm text-brand-brown/60">
              {products.length} result{products.length === 1 ? '' : 's'} for “{q}”
              {' · '}<Link href={categorySlug ? `/shop?category=${categorySlug}` : '/shop'} className="text-brand-terra underline">clear</Link>
            </p>
          )}

          {/* Product grid */}
          {products.length > 0 ? (
            <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  rating={ratingMap.get(product.id)?.avg}
                  reviewCount={ratingMap.get(product.id)?.count}
                />
              ))}
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
