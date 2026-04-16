'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

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
  variants: Variant[]
  images: Image[]
}

interface VariantInput {
  id?: string
  name: string
  priceCents: string
  costCents: string
  weightOz: string
  stockQuantity: string
  sku: string
  isActive: boolean
}

function variantToInput(v: Variant): VariantInput {
  return {
    id: v.id,
    name: v.name,
    priceCents: (v.priceCents / 100).toFixed(2),
    costCents: v.costCents ? (v.costCents / 100).toFixed(2) : '',
    weightOz: v.weightOz?.toString() ?? '',
    stockQuantity: v.stockQuantity.toString(),
    sku: v.sku ?? '',
    isActive: v.isActive,
  }
}

const emptyVariant = (): VariantInput => ({
  name: '',
  priceCents: '',
  costCents: '',
  weightOz: '',
  stockQuantity: '0',
  sku: '',
  isActive: true,
})

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
  const [isActive, setIsActive] = useState(product.isActive)

  // Variants
  const [variants, setVariants] = useState<VariantInput[]>(
    product.variants.map(variantToInput),
  )

  // Images
  const [images, setImages] = useState<Image[]>(product.images)
  const [uploading, setUploading] = useState(false)

  // Form state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function addVariant() {
    setVariants([...variants, emptyVariant()])
  }

  function removeVariant(idx: number) {
    setVariants(variants.filter((_, i) => i !== idx))
  }

  function updateVariant(idx: number, field: keyof VariantInput, value: string | boolean) {
    setVariants(
      variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    )
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
      .filter((v) => v.name.trim())
      .map((v) => ({
        id: v.id,
        name: v.name.trim(),
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
        setSuccess('Product has order history and was deactivated instead of deleted.')
        setTimeout(() => setSuccess(null), 5000)
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
          </h2>
          <button type="button" onClick={addVariant} className="btn-ghost text-sm">
            + Add Variant
          </button>
        </div>

        {variants.length === 0 ? (
          <p className="text-sm text-brand-brown/50">No variants. Add at least one.</p>
        ) : (
          <div className="space-y-4">
            {variants.map((v, idx) => (
              <div
                key={v.id || `new-${idx}`}
                className={`rounded-lg border p-4 space-y-3 ${
                  v.isActive
                    ? 'border-brand-warm/60 bg-surface-muted'
                    : 'border-red-200 bg-red-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-brand-brown">
                    {v.id ? `Variant: ${v.name || '(unnamed)'}` : 'New Variant'}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-brand-brown/60">
                      <input
                        type="checkbox"
                        checked={v.isActive}
                        onChange={(e) => updateVariant(idx, 'isActive', e.target.checked)}
                        className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-brand-brown/60">Name *</label>
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-brand-brown/60">Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.priceCents}
                      onChange={(e) => updateVariant(idx, 'priceCents', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-brand-brown/60">Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.costCents}
                      onChange={(e) => updateVariant(idx, 'costCents', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-brand-brown/60">Weight (oz)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={v.weightOz}
                      onChange={(e) => updateVariant(idx, 'weightOz', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-brand-brown/60">Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={v.stockQuantity}
                      onChange={(e) => updateVariant(idx, 'stockQuantity', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-brand-brown/60">SKU</label>
                    <input
                      type="text"
                      value={v.sku}
                      onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
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
