import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'
import StoreLayout from '@/app/components/StoreLayout'
import ProductCard from '@/app/components/ProductCard'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Gifts',
  description: 'Ready-to-give gift sets and giftable handmade bath & body treats.',
}

export default async function GiftsPage() {
  // Curated gift sets first; if none are flagged yet, fall back to featured
  // products so the page is never empty.
  let products = await prisma.sM_Product.findMany({
    where: { isActive: true, isGiftSet: true },
    include: {
      category: true,
      variants: { where: { isActive: true }, orderBy: { priceCents: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
    },
    orderBy: { name: 'asc' },
  })
  let fallback = false
  if (products.length === 0) {
    fallback = true
    products = await prisma.sM_Product.findMany({
      where: { isActive: true, isFeatured: true },
      include: {
        category: true,
        variants: { where: { isActive: true }, orderBy: { priceCents: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
      take: 8,
    })
  }

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
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">Gifts 🎁</h1>
          <p className="mt-3 text-center text-brand-brown/60">
            {fallback
              ? 'Handmade favorites that make lovely gifts. Add a free gift message at checkout.'
              : 'Ready-to-give sets, handmade with love. Add a free gift message at checkout.'}
          </p>

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
              <div className="text-5xl mb-4">🎁</div>
              <p className="text-brand-brown/60">
                Gift sets are coming soon.{' '}
                <Link href="/shop" className="text-brand-terra hover:underline">Browse the shop</Link> in
                the meantime.
              </p>
            </div>
          )}
        </div>
      </div>
    </StoreLayout>
  )
}
