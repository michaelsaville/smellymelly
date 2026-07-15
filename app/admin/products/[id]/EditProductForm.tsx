'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const SIZE_RE = /^(\d+(?:\.\d+)?)\s*(oz|ml|g|lb)$/i
// Sentinel for the sizeless "Standard" group in the copy-scents dropdown
const STANDARD_KEY = '__standard__'

function parseName(name: string): { scent: string; size: string } {
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

function reconstructName(scent: string, size: string): string {
  const s = scent.trim()
  return size ? `${s} - ${size}` : s
}

type Category = { id: string; name: string }
type Image = { id: string; url: string; altText: string | null; sortOrder: number }
type Variant = {
  id: string
  name: string
  priceCents: number
  costCents: number | null
  weightOz: number | null
  stockQuantity: number
  sku: string | null
  isActive: boolean
}
type Product = {
  id: string
  name: string
  slug: string
  description: string | null
  scent: string | null
  ingredients: string | null
  categoryId: string
  isActive: boolean
  isFeatured: boolean
  isGiftSet: boolean
  variants: Variant[]
  images: Image[]
}

interface VariantInput {
  id?: string
  scent: string
  size: string
  priceCents: string
  costCents: string
  weightOz: string
  stockQuantity: string
  sku: string
  isActive: boolean
}

function variantToInput(v: Variant): VariantInput {
  const parsed = parseName(v.name)
  return {
    id: v.id,
    scent: parsed.scent,
    size: parsed.size,
    priceCents: (v.priceCents / 100).toFixed(2),
    costCents: v.costCents ? (v.costCents / 100).toFixed(2) : '',
    weightOz: v.weightOz?.toString() ?? '',
    stockQuantity: v.stockQuantity.toString(),
    sku: v.sku ?? '',
    isActive: v.isActive,
  }
}

function emptyVariant(size: string = ''): VariantInput {
  return {
    scent: '',
    size,
    priceCents: '',
    costCents: '',
    weightOz: '',
    stockQuantity: '0',
    sku: '',
    isActive: true,
  }
}

export default function EditProductForm({
  product,
  categories,
}: {
  product: Product
  categories: Category[]
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Product fields
  const [name, setName] = useState(product.name)
  const [categoryId, setCategoryId] = useState(product.categoryId)
  const [description, setDescription] = useState(product.description ?? '')
  const [ingredients, setIngredients] = useState(product.ingredients ?? '')
  const [isFeatured, setIsFeatured] = useState(product.isFeatured)
  const [isGiftSet, setIsGiftSet] = useState(product.isGiftSet)
  const [isActive, setIsActive] = useState(product.isActive)

  // Variants — parse names into scent+size and sort stably by scent per size
  const [variants, setVariants] = useState<VariantInput[]>(() => {
    const inputs = product.variants.map(variantToInput)
    return inputs.sort((a, b) => {
      const sw = sizeWeight(a.size) - sizeWeight(b.size)
      if (sw !== 0) return sw
      return a.scent.toLowerCase().localeCompare(b.scent.toLowerCase())
    })
  })

  const [showAddScent, setShowAddScent] = useState(false)
  const [newScentName, setNewScentName] = useState('')

  const [showAddSize, setShowAddSize] = useState(false)
  const [newSizeValue, setNewSizeValue] = useState('')
  const [copyScentsFrom, setCopyScentsFrom] = useState('')
  const [copyScope, setCopyScope] = useState<'all' | 'active'>('active')

  // Images
  const [images, setImages] = useState<Image[]>(product.images)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function addVariantToSize(size: string) {
    setVariants([...variants, emptyVariant(size)])
  }

  function removeVariant(idx: number) {
    setVariants(variants.filter((_, i) => i !== idx))
  }

  function updateVariant(idx: number, field: keyof VariantInput, value: string | boolean) {
    setVariants(
      variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    )
  }

  // Distinct sizes present, sorted
  const sizesPresent = useMemo(() => {
    const s = Array.from(new Set(variants.map((v) => v.size)))
    s.sort((a, b) => sizeWeight(a) - sizeWeight(b))
    return s
  }, [variants])

  // Group variant indices by size (preserves insertion order within each group)
  const groupedBySize = useMemo(() => {
    const map = new Map<string, number[]>()
    variants.forEach((v, idx) => {
      const arr = map.get(v.size) ?? []
      arr.push(idx)
      map.set(v.size, arr)
    })
    return sizesPresent.map((size) => ({ size, indices: map.get(size) ?? [] }))
  }, [variants, sizesPresent])

  function handleAddScentAllSizes() {
    const scent = newScentName.trim()
    if (!scent) return
    const sizes = sizesPresent.length > 0 ? sizesPresent : ['']
    const newRows: VariantInput[] = sizes.map((size) => {
      // Default price = first existing variant's price in that size, if any
      const sibling = variants.find((v) => v.size === size && v.priceCents)
      return {
        scent,
        size,
        priceCents: sibling?.priceCents ?? '',
        costCents: '',
        weightOz: '',
        stockQuantity: '0',
        sku: '',
        isActive: true,
      }
    })
    setVariants([...variants, ...newRows])
    setNewScentName('')
    setShowAddScent(false)
  }

  function handleAddSize() {
    const raw = newSizeValue.trim().toLowerCase()
    if (!raw) return
    if (!SIZE_RE.test(raw)) {
      setError(
        'Size must be a number followed by oz, ml, g, or lb — e.g. "2oz", "8oz", "250ml".',
      )
      return
    }
    // Normalize "8 oz" -> "8oz" so it round-trips through the name parser
    const size = raw.replace(/\s+/g, '')
    if (sizesPresent.includes(size)) {
      setError(`Size "${size}" already exists.`)
      return
    }

    let newRows: VariantInput[] = []
    if (copyScentsFrom) {
      const sourceSize = copyScentsFrom === STANDARD_KEY ? '' : copyScentsFrom
      // De-dupe scents in the source size (keep first occurrence)
      const seen = new Set<string>()
      for (const src of variants) {
        if (src.size !== sourceSize) continue
        if (copyScope === 'active' && !src.isActive) continue
        const key = src.scent.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        newRows.push({
          scent: src.scent,
          size,
          // Start from the source size's price/cost — editable per row below
          priceCents: src.priceCents,
          costCents: src.costCents,
          weightOz: '',
          stockQuantity: '0',
          sku: '',
          // Preserve active state when copying "all"; active-only rows are all active
          isActive: copyScope === 'active' ? true : src.isActive,
        })
      }
    }
    if (newRows.length === 0) {
      newRows = [emptyVariant(size)]
    }

    setVariants([...variants, ...newRows])
    setNewSizeValue('')
    setCopyScentsFrom('')
    setShowAddSize(false)
    setError(null)
  }

  // --- Image upload ---
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return

    setUploading(true)
    setError(null)

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('productId', product.id)

      try {
        const res = await fetch('/api/admin/images', {
          method: 'POST',
          body: formData,
        })
        const json = await res.json()
        if (json.error) {
          setError(json.error)
        } else {
          setImages((prev) => [...prev, json.data])
        }
      } catch {
        setError('Failed to upload image')
      }
    }

    setUploading(false)
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleImageDelete(imageId: string) {
    try {
      const res = await fetch('/api/admin/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
      } else {
        setImages((prev) => prev.filter((img) => img.id !== imageId))
      }
    } catch {
      setError('Failed to delete image')
    }
  }

  // --- Save product ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !categoryId) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const variantData = variants
      .filter((v) => v.scent.trim())
      .map((v) => ({
        id: v.id,
        name: reconstructName(v.scent, v.size.trim().toLowerCase()),
        priceCents: Math.round(parseFloat(v.priceCents || '0') * 100),
        costCents: v.costCents ? Math.round(parseFloat(v.costCents) * 100) : null,
        weightOz: v.weightOz ? parseFloat(v.weightOz) : null,
        stockQuantity: parseInt(v.stockQuantity || '0', 10),
        sku: v.sku.trim() || null,
        isActive: v.isActive,
      }))

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          categoryId,
          description: description.trim() || null,
          ingredients: ingredients.trim() || null,
          isFeatured,
          isGiftSet,
          isActive,
          variants: variantData,
        }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
      } else {
        setSuccess('Product updated successfully.')
        // Update variants with server-generated IDs for new ones
        if (json.data?.variants) {
          setVariants(json.data.variants.map(variantToInput))
        }
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch {
      setError('Failed to update product')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Delete product ---
  async function handleDelete() {
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
        setDeleting(false)
        return
      }
      if (json.data?.deactivated) {
        setIsActive(false)
        setShowDeleteConfirm(false)
        setDeleting(false)
        const reason = json.data.reason
          ? `Product was deactivated instead of deleted — it ${json.data.reason}.`
          : 'Product was deactivated instead of deleted.'
        setSuccess(reason)
        setTimeout(() => setSuccess(null), 8000)
      } else {
        router.push('/admin/products')
      }
    } catch {
      setError('Failed to delete product')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {/* Product Details */}
      <div className="card space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Product Details
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-brown">
              Product Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-brown">
              Category *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-brand-brown">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
            />
            Featured on homepage
          </label>
          <label className="flex items-center gap-2 text-sm text-brand-brown">
            <input
              type="checkbox"
              checked={isGiftSet}
              onChange={(e) => setIsGiftSet(e.target.checked)}
              className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
            />
            Gift set (show on /gifts)
          </label>
          <label className="flex items-center gap-2 text-sm text-brand-brown">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
            />
            Active (visible in store)
          </label>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brand-brown">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input resize-y"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-brand-brown">
            Ingredients
          </label>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            rows={3}
            className="input resize-y"
            placeholder="e.g. Shea Butter, Coconut Oil, Sugar, Lemon Essential Oil, Vitamin E"
          />
          <p className="mt-1 text-xs text-brand-brown/40">
            Comma-separated list for the back label
          </p>
        </div>

        <div className="text-xs text-brand-brown/40">
          Slug: {product.slug}
        </div>
      </div>

      {/* Images */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Images
          </h2>
          <label className="btn-ghost text-sm cursor-pointer">
            {uploading ? 'Uploading...' : '+ Upload Images'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {images.length === 0 ? (
          <p className="text-sm text-brand-brown/50">
            No images yet. Upload some product photos.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div key={img.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-brand-warm/60 bg-surface-muted">
                  <img
                    src={img.url}
                    alt={img.altText || ''}
                    className="h-full w-full object-cover"
                  />
                </div>
                {idx === 0 && (
                  <span className="absolute top-1 left-1 rounded bg-brand-terra/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Main
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleImageDelete(img.id)}
                  className="absolute top-1 right-1 rounded-full bg-red-600/80 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="Delete image"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variants */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Variants
            <span className="ml-2 text-sm font-normal text-brand-brown/50">
              ({variants.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddSize(false)
                setShowAddScent((s) => !s)
              }}
              className="btn-ghost text-sm"
            >
              + Add Scent
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddScent(false)
                setShowAddSize((s) => !s)
              }}
              className="btn-ghost text-sm"
            >
              + Add Size
            </button>
          </div>
        </div>

        {showAddScent && (
          <div className="rounded-lg border border-brand-terra/40 bg-brand-peach/10 p-3 space-y-2">
            <label className="block text-xs font-medium text-brand-brown/80">
              New scent name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newScentName}
                onChange={(e) => setNewScentName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddScentAllSizes()
                  }
                }}
                placeholder="e.g. Peach Cobbler"
                className="input text-sm flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddScentAllSizes}
                disabled={!newScentName.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                {sizesPresent.length > 1
                  ? `Add to all ${sizesPresent.length} sizes`
                  : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddScent(false)
                  setNewScentName('')
                }}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
            </div>
            {sizesPresent.length > 1 && (
              <p className="text-xs text-brand-brown/50">
                Creates one variant per existing size ({sizesPresent.join(', ')}),
                pre-filled with that size&apos;s current price. Edit each row below.
              </p>
            )}
          </div>
        )}

        {showAddSize && (
          <div className="rounded-lg border border-brand-terra/40 bg-brand-peach/10 p-3 space-y-2">
            <label className="block text-xs font-medium text-brand-brown/80">
              New size
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newSizeValue}
                onChange={(e) => setNewSizeValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSize()
                  }
                }}
                placeholder="e.g. 8oz"
                className="input text-sm w-28"
                autoFocus
              />
              {variants.length > 0 && (
                <select
                  value={copyScentsFrom}
                  onChange={(e) => setCopyScentsFrom(e.target.value)}
                  className="input text-sm flex-1 min-w-[180px]"
                >
                  <option value="">Start with one empty scent</option>
                  {sizesPresent.map((s) => (
                    <option key={s || STANDARD_KEY} value={s || STANDARD_KEY}>
                      Copy scents from {s || 'Standard'}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={handleAddSize}
                disabled={!newSizeValue.trim()}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddSize(false)
                  setNewSizeValue('')
                  setCopyScentsFrom('')
                  setCopyScope('active')
                }}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
            </div>
            {copyScentsFrom && (
              <div className="flex items-center gap-4 text-xs text-brand-brown/80">
                <span className="font-medium">Which scents:</span>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="copyScope"
                    checked={copyScope === 'active'}
                    onChange={() => setCopyScope('active')}
                    className="text-brand-terra focus:ring-brand-terra"
                  />
                  Active only
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="copyScope"
                    checked={copyScope === 'all'}
                    onChange={() => setCopyScope('all')}
                    className="text-brand-terra focus:ring-brand-terra"
                  />
                  All scents
                </label>
              </div>
            )}
            <p className="text-xs text-brand-brown/50">
              Use a number plus a unit — oz, ml, g, or lb (e.g. 2oz, 8oz, 250ml).
              {copyScentsFrom
                ? copyScope === 'active'
                  ? ` The active scents in ${copyScentsFrom === STANDARD_KEY ? 'Standard' : copyScentsFrom} are copied into the new size, starting from their current price. Edit each row below.`
                  : ` Every scent in ${copyScentsFrom === STANDARD_KEY ? 'Standard' : copyScentsFrom} (active and inactive) is copied into the new size, keeping each one's active state. Edit each row below.`
                : ' A single blank scent row is created for the new size.'}
            </p>
          </div>
        )}

        {variants.length === 0 ? (
          <p className="text-sm text-brand-brown/50">
            No variants yet. Click &quot;+ Add Scent&quot; above to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {groupedBySize.map((group) => (
              <div
                key={group.size || '__default__'}
                className="rounded-lg border border-brand-warm/60 bg-surface-muted overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-brand-warm/60 bg-white/40 px-3 py-2">
                  <h3 className="text-sm font-semibold text-brand-brown">
                    {group.size || 'Standard'}
                    <span className="ml-2 text-xs font-normal text-brand-brown/50">
                      ({group.indices.length})
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => addVariantToSize(group.size)}
                    className="text-xs text-brand-terra hover:underline"
                  >
                    + Add scent to {group.size || 'Standard'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-medium uppercase tracking-wide text-brand-brown/50">
                        <th className="px-2 py-1.5">Scent</th>
                        <th className="px-2 py-1.5 w-[90px]">Price $</th>
                        <th className="px-2 py-1.5 w-[90px]">Cost $</th>
                        <th className="px-2 py-1.5 w-[70px]">Stock</th>
                        <th className="px-2 py-1.5 w-[70px]">Oz</th>
                        <th className="px-2 py-1.5 w-[110px]">SKU</th>
                        <th className="px-2 py-1.5 w-[60px] text-center">Active</th>
                        <th className="w-[32px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.indices.map((idx) => {
                        const v = variants[idx]
                        return (
                          <tr
                            key={v.id || `new-${idx}`}
                            className={`border-t border-brand-warm/30 ${
                              v.isActive ? '' : 'bg-red-50/40'
                            }`}
                          >
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                value={v.scent}
                                onChange={(e) =>
                                  updateVariant(idx, 'scent', e.target.value)
                                }
                                placeholder="Scent name"
                                className="input text-sm w-full"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.priceCents}
                                onChange={(e) =>
                                  updateVariant(idx, 'priceCents', e.target.value)
                                }
                                className="input text-sm w-full"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={v.costCents}
                                onChange={(e) =>
                                  updateVariant(idx, 'costCents', e.target.value)
                                }
                                className="input text-sm w-full"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                min="0"
                                value={v.stockQuantity}
                                onChange={(e) =>
                                  updateVariant(idx, 'stockQuantity', e.target.value)
                                }
                                className="input text-sm w-full"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={v.weightOz}
                                onChange={(e) =>
                                  updateVariant(idx, 'weightOz', e.target.value)
                                }
                                className="input text-sm w-full"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="text"
                                value={v.sku}
                                onChange={(e) =>
                                  updateVariant(idx, 'sku', e.target.value)
                                }
                                className="input text-sm w-full"
                              />
                            </td>
                            <td className="px-2 py-1 text-center">
                              <input
                                type="checkbox"
                                checked={v.isActive}
                                onChange={(e) =>
                                  updateVariant(idx, 'isActive', e.target.checked)
                                }
                                className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
                              />
                            </td>
                            <td className="px-1 py-1 text-center">
                              <button
                                type="button"
                                onClick={() => removeVariant(idx)}
                                aria-label={`Remove ${v.scent || 'variant'}`}
                                className="text-lg leading-none text-red-400 hover:text-red-600"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <a
            href={`/admin/products/${product.id}/labels`}
            className="btn-ghost text-sm"
          >
            Print Labels
          </a>
          <a href="/admin/products" className="btn-ghost">
            Cancel
          </a>
        </div>

        {/* Delete */}
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete Product
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-red-600">Are you sure?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-sm text-brand-brown/60 hover:text-brand-brown"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </form>
  )
}
