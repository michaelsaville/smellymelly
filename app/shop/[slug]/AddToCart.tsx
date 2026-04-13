'use client'

import { useState } from 'react'

interface Variant {
  id: string
  name: string
  priceCents: number
  stockQuantity: number
}

interface AddToCartProps {
  variants: Variant[]
  productName: string
  productSlug: string
  imageUrl: string | null
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function AddToCart({ variants, productName, productSlug, imageUrl }: AddToCartProps) {
  // Default to first in-stock variant, or first variant if all OOS
  const firstInStock = variants.find((v) => v.stockQuantity > 0)
  const [selectedId, setSelectedId] = useState(firstInStock?.id ?? variants[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const selected = variants.find((v) => v.id === selectedId)
  const inStock = selected ? selected.stockQuantity > 0 : false
  const maxQty = selected ? selected.stockQuantity : 0

  function handleSelectVariant(id: string) {
    setSelectedId(id)
    setQuantity(1)
    setAdded(false)
  }

  function handleAdd() {
    if (!selected || !inStock) return

    const cart: {
      variantId: string
      productName: string
      variantName: string
      priceCents: number
      quantity: number
      slug: string
      imageUrl: string | null
    }[] = JSON.parse(localStorage.getItem('sm_cart') || '[]')

    const existing = cart.find((item) => item.variantId === selected.id)
    if (existing) {
      existing.quantity += quantity
    } else {
      cart.push({
        variantId: selected.id,
        productName,
        variantName: selected.name,
        priceCents: selected.priceCents,
        quantity,
        slug: productSlug,
        imageUrl,
      })
    }

    localStorage.setItem('sm_cart', JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('sm:cart-updated'))

    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (variants.length === 0) {
    return (
      <p className="text-brand-brown/60 italic">This product is currently unavailable.</p>
    )
  }

  return (
    <div className="space-y-6">
      {/* Variant selector */}
      <div>
        <label className="block text-sm font-medium text-brand-brown mb-2">
          {variants.length > 1 ? 'Select an option' : 'Option'}
        </label>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const oos = v.stockQuantity <= 0
            const isSelected = v.id === selectedId
            return (
              <button
                key={v.id}
                onClick={() => handleSelectVariant(v.id)}
                disabled={oos}
                className={`relative rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-brand-terra bg-brand-terra/5 text-brand-terra ring-1 ring-brand-terra'
                    : oos
                    ? 'border-brand-warm/40 bg-surface-muted text-brand-brown/30 cursor-not-allowed'
                    : 'border-brand-warm/60 text-brand-brown hover:border-brand-terra/40'
                }`}
              >
                <span>{v.name}</span>
                <span className="ml-2">{formatPrice(v.priceCents)}</span>
                {oos && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-red-400">
                    Sold out
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Quantity + Add to cart */}
      {selected && inStock && (
        <div className="flex items-center gap-4">
          {/* Quantity selector */}
          <div className="flex items-center rounded-lg border border-brand-warm/60">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-2 text-brand-brown hover:text-brand-terra transition-colors disabled:opacity-30"
              disabled={quantity <= 1}
            >
              -
            </button>
            <span className="w-10 text-center text-sm font-medium text-brand-dark">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              className="px-3 py-2 text-brand-brown hover:text-brand-terra transition-colors disabled:opacity-30"
              disabled={quantity >= maxQty}
            >
              +
            </button>
          </div>

          {/* Add to cart button */}
          <button onClick={handleAdd} className="btn-primary flex-1 relative">
            {added ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Added!
              </span>
            ) : (
              `Add to Cart — ${formatPrice(selected.priceCents * quantity)}`
            )}
          </button>
        </div>
      )}

      {selected && !inStock && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          This option is currently out of stock.
        </div>
      )}
    </div>
  )
}
