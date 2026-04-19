import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'
import StoreLayout from '@/app/components/StoreLayout'
import AddToCart from './AddToCart'

export const dynamic = 'force-dynamic'

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await prisma.sM_Product.findFirst({
    where: { slug, isActive: true },
    include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
  })
  if (!product) return { title: 'Product not found' }

  const description =
    product.description?.slice(0, 160) ||
    `${product.name} — handmade by Smelly Melly.`
  const image = product.images[0]?.url

  return {
    title: product.name,
    description,
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const product = await prisma.sM_Product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: true,
      variants: {
        where: { isActive: true },
        orderBy: { priceCents: 'asc' },
      },
      images: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!product) redirect('/shop')

  const prices = product.variants.map((v) => v.priceCents)
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null
  const mainImage = product.images[0] ?? null

  return (
    <StoreLayout>
      <div className="py-8 px-6">
        <div className="mx-auto max-w-6xl">
          {/* Breadcrumb */}
          <nav className="mb-8 flex items-center gap-2 text-sm text-brand-brown/60">
            <Link href="/shop" className="hover:text-brand-terra transition-colors">
              Shop
            </Link>
            <span>/</span>
            {product.category && (
              <>
                <Link
                  href={`/shop?category=${product.category.slug}`}
                  className="hover:text-brand-terra transition-colors"
                >
                  {product.category.name}
                </Link>
                <span>/</span>
              </>
            )}
            <span className="text-brand-dark">{product.name}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Image gallery */}
            <div className="space-y-3">
              {/* Main image */}
              <div className="aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-brand-peach/30 to-brand-warm">
                {mainImage ? (
                  <img
                    src={mainImage.url}
                    alt={mainImage.altText || product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="text-6xl opacity-30">
                      {product.category?.name === 'Candles' ? '🕯️' :
                       product.category?.name === 'Soaps' ? '🧼' :
                       product.category?.name === 'Bath Bombs' ? '🛁' :
                       product.category?.name === 'Lip Balm' ? '💋' :
                       product.category?.name === 'Beard Balm' ? '🧔' : '✨'}
                    </span>
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {product.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {product.images.map((img) => (
                    <div
                      key={img.id}
                      className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 border-brand-warm/60 hover:border-brand-terra transition-colors cursor-pointer"
                    >
                      <img
                        src={img.url}
                        alt={img.altText || product.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Product info */}
            <div className="space-y-6">
              {/* Category + Name */}
              <div>
                {product.category && (
                  <Link
                    href={`/shop?category=${product.category.slug}`}
                    className="text-xs font-medium uppercase tracking-wide text-brand-terra hover:underline"
                  >
                    {product.category.name}
                  </Link>
                )}
                <h1 className="mt-1 font-display text-3xl font-bold text-brand-dark sm:text-4xl">
                  {product.name}
                </h1>
              </div>

              {/* Scent badge */}
              {product.scent && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-brand-peach/20 px-3 py-1 text-sm font-medium text-brand-brown">
                    Scent: {product.scent}
                  </span>
                </div>
              )}

              {/* Price range summary */}
              {minPrice !== null && (
                <div className="text-2xl font-semibold text-brand-terra">
                  {minPrice === maxPrice
                    ? formatPrice(minPrice)
                    : `${formatPrice(minPrice)} — ${formatPrice(maxPrice!)}`}
                </div>
              )}

              {/* Description */}
              {product.description && (
                <div className="prose prose-sm text-brand-brown/80 leading-relaxed">
                  {product.description.split('\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              )}

              {/* Divider */}
              <hr className="border-brand-warm/60" />

              {/* Add to cart (client component) */}
              <AddToCart
                variants={product.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  priceCents: v.priceCents,
                  stockQuantity: v.stockQuantity,
                }))}
                productName={product.name}
                productSlug={product.slug}
                imageUrl={mainImage?.url ?? null}
              />
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
