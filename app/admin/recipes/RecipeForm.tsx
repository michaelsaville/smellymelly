'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const UNIT_OPTIONS = [
  { value: 'oz', label: 'oz', group: 'Weight' },
  { value: 'g', label: 'g', group: 'Weight' },
  { value: 'lb', label: 'lb', group: 'Weight' },
  { value: 'kg', label: 'kg', group: 'Weight' },
  { value: 'fl_oz', label: 'fl oz', group: 'Volume' },
  { value: 'ml', label: 'mL', group: 'Volume' },
  { value: 'L', label: 'L', group: 'Volume' },
  { value: 'cups', label: 'cups', group: 'Volume' },
  { value: 'tbsp', label: 'tbsp', group: 'Volume' },
  { value: 'tsp', label: 'tsp', group: 'Volume' },
  { value: 'drops', label: 'drops', group: 'Other' },
  { value: 'count', label: 'each', group: 'Other' },
]

// Unit conversion factors (same as server-side units.ts)
const TO_GRAMS: Record<string, number> = { g: 1, oz: 28.3495, lb: 453.592, kg: 1000 }
const TO_ML: Record<string, number> = { ml: 1, fl_oz: 29.5735, L: 1000, cups: 236.588, tbsp: 14.7868, tsp: 4.92892 }

function convertUnits(qty: number, from: string, to: string): number | null {
  if (from === to) return qty
  const getGroup = (u: string) => {
    if (u in TO_GRAMS) return TO_GRAMS
    if (u in TO_ML) return TO_ML
    if (u === 'drops' || u === 'count') return { [u]: 1 }
    return null
  }
  const fg = getGroup(from)
  const tg = getGroup(to)
  if (!fg || !tg || fg !== tg) return null
  return (qty * fg[from]) / tg[to]
}

type Material = {
  id: string
  name: string
  packageCostCents: number
  packageSize: number
  packageUnit: string
  supplier: string | null
  isActive: boolean
}

type Product = { id: string; name: string }

type RecipeItemInput = {
  materialId: string
  quantity: string
  unit: string
}

interface RecipeFormProps {
  materials: Material[]
  products: Product[]
  initial?: {
    id: string
    name: string
    productId: string | null
    yields: number
    notes: string | null
    items: { materialId: string; quantity: number; unit: string }[]
  }
}

export default function RecipeForm({ materials, products, initial }: RecipeFormProps) {
  const router = useRouter()
  const isEdit = !!initial

  const [name, setName] = useState(initial?.name ?? '')
  const [productId, setProductId] = useState(initial?.productId ?? '')
  const [yields, setYields] = useState(initial?.yields?.toString() ?? '1')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [items, setItems] = useState<RecipeItemInput[]>(
    initial?.items.map((i) => ({
      materialId: i.materialId,
      quantity: i.quantity.toString(),
      unit: i.unit,
    })) ?? [],
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const materialMap = useMemo(
    () => new Map(materials.map((m) => [m.id, m])),
    [materials],
  )

  function addItem() {
    setItems([...items, { materialId: materials[0]?.id ?? '', quantity: '', unit: 'oz' }])
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof RecipeItemInput, value: string) {
    setItems(items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)))
  }

  // Calculate costs
  const itemCosts = useMemo(() => {
    return items.map((item) => {
      const mat = materialMap.get(item.materialId)
      const qty = parseFloat(item.quantity)
      if (!mat || !qty || qty <= 0) return null
      const converted = convertUnits(qty, item.unit, mat.packageUnit)
      if (converted === null) return null
      const costPerPkgUnit = mat.packageCostCents / mat.packageSize
      return costPerPkgUnit * converted
    })
  }, [items, materialMap])

  const batchCostCents = itemCosts.reduce<number>((sum, c) => sum + (c ?? 0), 0)
  const yieldsNum = Math.max(1, parseInt(yields) || 1)
  const perUnitCents = batchCostCents / yieldsNum

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)

    const validItems = items
      .filter((i) => i.materialId && parseFloat(i.quantity) > 0)
      .map((i) => ({
        materialId: i.materialId,
        quantity: i.quantity,
        unit: i.unit,
      }))

    const payload = {
      name: name.trim(),
      productId: productId || null,
      yields,
      notes: notes.trim() || null,
      items: validItems,
    }

    try {
      const url = isEdit
        ? `/api/admin/recipes/${initial!.id}`
        : '/api/admin/recipes'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
      } else {
        router.push('/admin/recipes')
        router.refresh()
      }
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this recipe?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/recipes/${initial!.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
        setDeleting(false)
      } else {
        router.push('/admin/recipes')
        router.refresh()
      }
    } catch {
      setError('Failed to delete')
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {/* Recipe details */}
      <div className="card space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Recipe Details
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-sm font-medium text-brand-brown">
              Recipe Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g. Body Scrub — Lemon Frost"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-brown">
              Link to Product
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="input"
            >
              <option value="">None</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-brown">
              Batch Yields
            </label>
            <input
              type="number"
              min="1"
              value={yields}
              onChange={(e) => setYields(e.target.value)}
              className="input"
              placeholder="How many units per batch"
            />
            <p className="mt-1 text-xs text-brand-brown/40">
              How many jars/tins/bars one batch makes
            </p>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-brand-brown">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input resize-y"
            placeholder="Instructions, tips, etc."
          />
        </div>
      </div>

      {/* Materials used */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Materials Used
          </h2>
          <button type="button" onClick={addItem} className="btn-ghost text-sm">
            + Add Material
          </button>
        </div>

        {materials.length === 0 && (
          <p className="text-sm text-red-600">
            No materials found.{' '}
            <a href="/admin/materials" className="underline">
              Add some materials first
            </a>
            .
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-brand-brown/50">
            No materials added yet. Click &quot;+ Add Material&quot; to build the recipe.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const mat = materialMap.get(item.materialId)
              const itemCost = itemCosts[idx]

              return (
                <div
                  key={idx}
                  className="rounded-lg border border-brand-warm/60 bg-surface-muted p-3"
                >
                  <div className="grid grid-cols-12 gap-3 items-end">
                    <div className="col-span-5">
                      <label className="mb-1 block text-xs text-brand-brown/60">
                        Material
                      </label>
                      <select
                        value={item.materialId}
                        onChange={(e) => updateItem(idx, 'materialId', e.target.value)}
                        className="input text-sm"
                      >
                        {materials
                          .filter((m) => m.isActive)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-brand-brown/60">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                        className="input text-sm"
                        placeholder="2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs text-brand-brown/60">
                        Unit
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                        className="input text-sm"
                      >
                        {UNIT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 text-right">
                      {itemCost !== null ? (
                        <span className="text-sm font-semibold text-brand-dark">
                          ${(itemCost / 100).toFixed(2)}
                        </span>
                      ) : item.quantity ? (
                        <span className="text-xs text-red-500">unit mismatch</span>
                      ) : null}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {mat && (
                    <p className="text-[10px] text-brand-brown/40 mt-1">
                      Bought: {mat.packageSize} {mat.packageUnit} for $
                      {(mat.packageCostCents / 100).toFixed(2)}
                      {mat.supplier ? ` from ${mat.supplier}` : ''}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cost summary */}
      {items.length > 0 && (
        <div className="card bg-brand-terra/5 border-brand-terra/20">
          <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
            Cost Breakdown
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-brand-brown/50 uppercase tracking-wide">
                Batch Cost
              </p>
              <p className="text-2xl font-bold text-brand-dark">
                ${(batchCostCents / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-brown/50 uppercase tracking-wide">
                Per Unit ({yieldsNum} yield{yieldsNum !== 1 ? 's' : ''})
              </p>
              <p className="text-2xl font-bold text-brand-terra">
                ${(perUnitCents / 100).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-brand-brown/50 uppercase tracking-wide">
                Materials
              </p>
              <p className="text-2xl font-bold text-brand-dark">
                {items.filter((i) => parseFloat(i.quantity) > 0).length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
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
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Recipe'}
          </button>
          <a href="/admin/recipes" className="btn-ghost">
            Cancel
          </a>
        </div>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Recipe'}
          </button>
        )}
      </div>
    </form>
  )
}
