'use client'

import { useMemo, useState } from 'react'

interface Variant {
  id: string
  name: string
  priceCents: number
  stockQuantity: number
  scentDescription: string | null
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

const SIZE_RE = /^(\d+(?:\.\d+)?)\s*(oz|ml|g|lb)$/i

function parseVariant(name: string): { scent: string; size: string } {
  const idx = name.lastIndexOf(' - ')
  if (idx >= 0) {
    const tail = name.slice(idx + 3).trim()
    if (SIZE_RE.test(tail)) {
      return { scent: name.slice(0, idx).trim(), size: tail.toLowerCase() }
    }
  }
  return { scent: name.trim(), size: '' }
}

function sizeWeight(size: string): number {
  const m = size.match(/^(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : Number.POSITIVE_INFINITY
}

type Parsed = Variant & { scent: string; size: string }

export default function AddToCart({ variants, productName, productSlug, imageUrl }: AddToCartProps) {
  const parsed = useMemo<Parsed[]>(
    () => variants.map((v) => ({ ...v, ...parseVariant(v.name) })),
    [variants],
  )

  const sizes = useMemo(() => {
    const s = Array.from(new Set(parsed.map((p) => p.size)))
    s.sort((a, b) => sizeWeight(a) - sizeWeight(b))
    return s
  }, [parsed])

  const showSizeDropdown = sizes.length > 1

  const firstInStock = parsed.find((v) => v.stockQuantity > 0)
  const initialSize = firstInStock?.size ?? sizes[0] ?? ''
  const initialScent = firstInStock?.scent ?? null

  const [size, setSize] = useState<string>(initialSize)
  const [scent, setScent] = useState<string | null>(initialScent)
  const [scentFilter, setScentFilter] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const scentsForSize = useMemo(
    () => parsed.filter((p) => p.size === size),
    [parsed, size],
  )

  const showScentFilter = scentsForSize.length > 12

  const visibleScents = useMemo(() => {
    if (!scentFilter.trim()) return scentsForSize
    const q = scentFilter.trim().toLowerCase()
    return scentsForSize.filter(
      (p) => p.scent.toLowerCase().includes(q) || p.scent === scent,
    )
  }, [scentsForSize, scentFilter, scent])

  function handleSizeChange(newSize: string) {
    const stillExists = parsed.some((p) => p.size === newSize && p.scent === scent)
    setSize(newSize)
    if (!stillExists) setScent(null)
    setQuantity(1)
    setAdded(false)
  }

  function handleScentToggle(target: string) {
    setScent((prev) => (prev === target ? null : target))
    setQuantity(1)
    setAdded(false)
  }

  const selected =
    scent !== null
      ? parsed.find((p) => p.size === size && p.scent === scent) ?? null
      : null
  const inStock = selected ? selected.stockQuantity > 0 : false
  const maxQty = selected ? selected.stockQuantity : 0

  // Description for the currently-selected scent. All variants of the same
  // scent share the same description, so any matching variant works as the
  // source — selected is preferred so it tracks the picker exactly.
  const scentDescription =
    scent !== null
      ? selected?.scentDescription ??
        parsed.find((p) => p.scent === scent && p.scentDescription)?.scentDescription ??
        null
      : null

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
    return <p className="text-brand-brown/60 italic">This product is currently unavailable.</p>
  }

  const hasScentChoice = scentsForSize.some((v) => v.scent.length > 0) && scentsForSize.length > 1

  return (
    <div className="space-y-6">
      {showSizeDropdown && (
        <div>
          <label htmlFor="size-select" className="mb-2 block text-sm font-medium text-brand-brown">
            Size
          </label>
          <select
            id="size-select"
            value={size}
            onChange={(e) => handleSizeChange(e.target.value)}
            className="input w-full sm:w-48"
          >
            {sizes.map((s) => (
              <option key={s || 'default'} value={s}>
                {s || 'Standard'}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasScentChoice && (
        <div>
          <label className="mb-2 block text-sm font-medium text-brand-brown">
            Scent
            {scent ? (
              <span className="ml-2 font-normal text-brand-brown/60">— {scent}</span>
            ) : (
              <span className="ml-2 font-normal text-brand-brown/40">
                (tap one to select)
              </span>
            )}
          </label>
          {showScentFilter && (
            <div className="relative mb-3">
              <input
                type="text"
                value={scentFilter}
                onChange={(e) => setScentFilter(e.target.value)}
                placeholder={`Filter ${scentsForSize.length} scents…`}
                className="input w-full pr-8 text-sm"
              />
              {scentFilter && (
                <button
                  type="button"
                  onClick={() => setScentFilter('')}
                  aria-label="Clear filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-brand-brown/50 hover:text-brand-brown"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {visibleScents.length === 0 && (
              <p className="text-sm text-brand-brown/50">No scents match that search.</p>
            )}
            {visibleScents.map((v) => {
              const oos = v.stockQuantity <= 0
              const isSelected = v.scent === scent
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => !oos && handleScentToggle(v.scent)}
                  disabled={oos}
                  aria-pressed={isSelected}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    isSelected
                      ? 'border-brand-terra bg-brand-terra text-white shadow-sm'
                      : oos
                      ? 'border-brand-warm/40 bg-surface-muted text-brand-brown/30 line-through cursor-not-allowed'
                      : 'border-brand-warm/60 bg-white/60 text-brand-brown/60 hover:border-brand-terra/60 hover:text-brand-brown'
                  }`}
                >
                  {v.scent}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {!hasScentChoice && scentsForSize.length === 1 && scentsForSize[0].scent && (
        <div>
          <label className="mb-2 block text-sm font-medium text-brand-brown">Scent</label>
          <span className="inline-flex items-center rounded-full border border-brand-warm/60 bg-brand-peach/20 px-3 py-1.5 text-sm font-medium text-brand-brown">
            {scentsForSize[0].scent}
          </span>
          {scentsForSize[0].scentDescription && (
            <ScentDescriptionPanel
              scent={scentsForSize[0].scent}
              description={scentsForSize[0].scentDescription}
            />
          )}
        </div>
      )}

      {hasScentChoice && scent && scentDescription && (
        <ScentDescriptionPanel scent={scent} description={scentDescription} />
      )}

      {selected && inStock ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-lg border border-brand-warm/60">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="px-3 py-2 text-brand-brown transition-colors hover:text-brand-terra disabled:opacity-30"
              disabled={quantity <= 1}
            >
              -
            </button>
            <span className="w-10 text-center text-sm font-medium text-brand-dark">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              className="px-3 py-2 text-brand-brown transition-colors hover:text-brand-terra disabled:opacity-30"
              disabled={quantity >= maxQty}
            >
              +
            </button>
          </div>
          <button type="button" onClick={handleAdd} className="btn-primary relative flex-1">
            {added ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Added!
              </span>
            ) : (
              `Add to Cart — ${formatPrice(selected.priceCents * quantity)}`
            )}
          </button>
        </div>
      ) : selected && !inStock ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          This scent is currently out of stock in this size.
        </div>
      ) : (
        <button
          type="button"
          disabled
          className="btn-primary w-full cursor-not-allowed opacity-50"
        >
          Select a scent
        </button>
      )}
    </div>
  )
}

function ScentDescriptionPanel({
  scent,
  description,
}: {
  scent: string
  description: string
}) {
  return (
    <div className="mt-3 rounded-lg border border-brand-warm/60 bg-brand-cream/40 p-4 text-sm leading-relaxed text-brand-brown/80">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-terra">
        About {scent}
      </div>
      {description}
    </div>
  )
}
