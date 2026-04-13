'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Category = { id: string; name: string }
type Scent = { id: string; name: string }

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

export function ProductForm({
  categories,
  scents,
}: {
  categories: Category[]
  scents: Scent[]
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [variants, setVariants] = useState<VariantInput[]>([emptyVariant()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scent-based variant generation
  const [useScents, setUseScents] = useState(false)
  const [selectedScents, setSelectedScents] = useState<string[]>(
    scents.map((s) => s.id),
  )
  const [scentPrice, setScentPrice] = useState('')
  const [scentCost, setScentCost] = useState('')
  const [scentWeight, setScentWeight] = useState('')
  const [scentStock, setScentStock] = useState('0')

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

  function toggleScent(id: string) {
    setSelectedScents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }

  function selectAllScents() {
    setSelectedScents(scents.map((s) => s.id))
  }

  function deselectAllScents() {
    setSelectedScents([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !categoryId) return
    setSubmitting(true)
    setError(null)

    // Build variant list — either from scents or manual
    let variantData: Array<{
      name: string
      priceCents: number
      costCents: number | null
      weightOz: number | null
      stockQuantity: number
      sku: string | null
    }>

    if (useScents && selectedScents.length > 0) {
      const priceCents = Math.round(parseFloat(scentPrice || '0') * 100)
      const costCents = scentCost
        ? Math.round(parseFloat(scentCost) * 100)
        : null
      const weightOz = scentWeight ? parseFloat(scentWeight) : null
      const stockQty = parseInt(scentStock || '0', 10)

      variantData = selectedScents.map((scentId) => {
        const scent = scents.find((s) => s.id === scentId)!
        return {
          name: scent.name,
          priceCents,
          costCents,
          weightOz,
          stockQuantity: stockQty,
          sku: null,
        }
      })
    } else {
      variantData = variants
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
        }))
    }

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scent: null,
          categoryId,
          description: description.trim() || null,
          isFeatured,
          variants: variantData,
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
              placeholder="e.g., Lip Balm"
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
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

      {/* Variant mode toggle */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Variants
          </h2>
          {scents.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-brand-brown">
              <input
                type="checkbox"
                checked={useScents}
                onChange={(e) => setUseScents(e.target.checked)}
                className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
              />
              Generate from Scents
            </label>
          )}
        </div>

        {useScents ? (
          /* Scent-based variant generation */
          <div className="space-y-4">
            <p className="text-sm text-brand-brown/60">
              One variant will be created for each selected scent, all with the same price/cost/weight.
            </p>

            {/* Base pricing for all scent variants */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  Price ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={scentPrice}
                  onChange={(e) => setScentPrice(e.target.value)}
                  className="input text-sm"
                  placeholder="5.00"
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
                  value={scentCost}
                  onChange={(e) => setScentCost(e.target.value)}
                  className="input text-sm"
                  placeholder="1.50"
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
                  value={scentWeight}
                  onChange={(e) => setScentWeight(e.target.value)}
                  className="input text-sm"
                  placeholder="0.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-brand-brown/60">
                  Stock (each)
                </label>
                <input
                  type="number"
                  min="0"
                  value={scentStock}
                  onChange={(e) => setScentStock(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>

            {/* Scent selection */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-brand-brown">
                  Scents ({selectedScents.length} selected)
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllScents}
                    className="text-xs text-brand-terra hover:underline"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllScents}
                    className="text-xs text-brand-brown/60 hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {scents.map((scent) => (
                  <label
                    key={scent.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selectedScents.includes(scent.id)
                        ? 'border-brand-terra bg-brand-terra/5 text-brand-dark'
                        : 'border-brand-warm/60 text-brand-brown/60 hover:border-brand-warm'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedScents.includes(scent.id)}
                      onChange={() => toggleScent(scent.id)}
                      className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
                    />
                    {scent.name}
                  </label>
                ))}
              </div>
              {scents.length === 0 && (
                <p className="text-sm text-brand-brown/50">
                  No scents defined yet.{' '}
                  <a
                    href="/admin/scents"
                    className="text-brand-terra hover:underline"
                  >
                    Add scents →
                  </a>
                </p>
              )}
            </div>
          </div>
        ) : (
          /* Manual variants */
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addVariant}
                className="btn-ghost text-sm"
              >
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
                      onChange={(e) =>
                        updateVariant(idx, 'priceCents', e.target.value)
                      }
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
                      onChange={(e) =>
                        updateVariant(idx, 'costCents', e.target.value)
                      }
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
                      onChange={(e) =>
                        updateVariant(idx, 'weightOz', e.target.value)
                      }
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
        )}
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
