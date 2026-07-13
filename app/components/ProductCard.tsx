import Link from 'next/link'
import Stars from '@/app/components/Stars'

type ProductCardProduct = {
  slug: string
  name: string
  scent: string | null
  category: { name: string } | null
  images: { url: string; altText: string | null }[]
  variants: { priceCents: number }[]
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const CATEGORY_EMOJI: Record<string, string> = {
  'Home Fragrance': '🏠',
  'Bath & Body': '🛁',
  'Lip Care': '💋',
  'Beard Oil': '🧴',
  'Beard Balm': '🧔',
}

export default function ProductCard({
  product,
  rating,
  reviewCount,
}: {
  product: ProductCardProduct
  rating?: number
  reviewCount?: number
}) {
  const image = product.images[0]
  const prices = product.variants.map((v) => v.priceCents)
  const minPrice = prices.length > 0 ? Math.min(...prices) : null
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="card p-0 overflow-hidden hover:border-brand-terra/40 hover:shadow-md transition-all group"
    >
      <div className="aspect-square relative bg-gradient-to-br from-brand-peach/30 to-brand-warm overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.altText || product.name}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl opacity-40">
              {(product.category && CATEGORY_EMOJI[product.category.name]) || '✨'}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-base font-semibold text-brand-dark group-hover:text-brand-terra transition-colors line-clamp-1">
          {product.name}
        </h3>
        {product.scent && <p className="mt-0.5 text-xs text-brand-brown/60">{product.scent}</p>}
        {reviewCount && reviewCount > 0 && rating ? (
          <div className="mt-1 flex items-center gap-1">
            <Stars rating={rating} className="text-xs" />
            <span className="text-[11px] text-brand-brown/50">({reviewCount})</span>
          </div>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-medium text-brand-terra">
            {minPrice !== null
              ? minPrice === maxPrice
                ? formatPrice(minPrice)
                : `From ${formatPrice(minPrice)}`
              : 'Price TBD'}
          </span>
          <span className="text-xs font-medium text-brand-brown/40 group-hover:text-brand-terra transition-colors">
            View
          </span>
        </div>
      </div>
    </Link>
  )
}
