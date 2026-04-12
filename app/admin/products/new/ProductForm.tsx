'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Category = { id: string; name: string }

interface VariantInput {
  name: string
  priceCents: string
  costCents: string
  weightOz: string
  stockQuantity: string
  sku: string
}

const emptyVariant = (): VariantInput => ({
  name: '',
  priceCents: '',
  costCents: '',
  weightOz: '',
  stockQuantity: '0',
  sku: '',
})

export function ProductForm({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [scent, setScent] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [variants, setVariants] = useState<VariantInput[]>([emptyVariant()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addVariant() {
    setVariants([...variants, emptyVariant()])
  }

  function removeVariant(idx: number) {
    setVariants(variants.filter((_, i) => i !== idx))
  }

  function updateVariant(idx: number, field: keyof VariantInput, value: string) {
    setVariants(
      variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !categoryId) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scent: scent.trim() || null,
          categoryId,
          description: description.trim() || null,
          isFeatured,
          variants: variants
            .filter((v) => v.name.trim())
            .map((v) => ({
              name: v.name.trim(),
              priceCents: Math.round(parseFloat(v.priceCents || '0') * 100),
              costCents: v.costCents
                ? Math.round(parseFloat(v.costCents) * 100)
                : null,
              weightOz: v.weightOz ? parseFloat(v.weightOz) : null,
              stockQuantity: parseInt(v.stockQuantity || '0', 10),
              sku: v.sku.trim() || null,
            })),
        }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
      } else {
        router.push('/admin/products')
      }
    } catch {
      setError('Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-6">
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
              placeholder="e.g., Lavender Dreams Candle"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-brown">
              Scent
            </label>
            <input
              type="text"
              value={scent}
              onChange={(e) => setScent(e.target.value)}
              className="input"
              placeholder="e.g., Lavender Dreams"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-brand-brown">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
              />
              Featured on homepage
            </label>
          </div>
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
            placeholder="Describe the product, ingredients, fragrance notes..."
          />
        </div>
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

        {variants.map((v, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-brand-warm/60 bg-surface-muted p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-brand-brown">
                Variant {idx + 1}
              </span>
              {variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  Name *
                </label>
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                  className="input text-sm"
                  placeholder="e.g., 8oz Tin"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v.priceCents}
                  onChange={(e) => updateVariant(idx, 'priceCents', e.target.value)}
                  className="input text-sm"
                  placeholder="12.00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={v.costCents}
                  onChange={(e) => updateVariant(idx, 'costCents', e.target.value)}
                  className="input text-sm"
                  placeholder="4.50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  Weight (oz)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={v.weightOz}
                  onChange={(e) => updateVariant(idx, 'weightOz', e.target.value)}
                  className="input text-sm"
                  placeholder="8.0"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={v.stockQuantity}
                  onChange={(e) =>
                    updateVariant(idx, 'stockQuantity', e.target.value)
                  }
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  SKU
                </label>
                <input
                  type="text"
                  value={v.sku}
                  onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                  className="input text-sm"
                  placeholder="LDC-8OZ"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {submitting ? 'Creating...' : 'Create Product'}
        </button>
        <a href="/admin/products" className="btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  )
}
