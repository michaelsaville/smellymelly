'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const UNIT_OPTIONS = [
  { value: 'oz', label: 'oz (weight)' },
  { value: 'g', label: 'grams' },
  { value: 'lb', label: 'pounds' },
  { value: 'kg', label: 'kg' },
  { value: 'fl_oz', label: 'fl oz' },
  { value: 'ml', label: 'mL' },
  { value: 'L', label: 'Liters' },
  { value: 'cups', label: 'cups' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'tsp', label: 'tsp' },
  { value: 'drops', label: 'drops' },
  { value: 'count', label: 'count/each' },
]

type Material = {
  id: string
  name: string
  packageCostCents: number
  packageSize: number
  packageUnit: string
  supplier: string | null
  notes: string | null
  isActive: boolean
}

export default function MaterialManager({
  initialMaterials,
}: {
  initialMaterials: Material[]
}) {
  const router = useRouter()
  const [materials, setMaterials] = useState(initialMaterials)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [size, setSize] = useState('')
  const [unit, setUnit] = useState('oz')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function resetForm() {
    setName('')
    setCost('')
    setSize('')
    setUnit('oz')
    setSupplier('')
    setNotes('')
    setEditId(null)
    setShowForm(false)
    setError(null)
  }

  function startEdit(m: Material) {
    setName(m.name)
    setCost((m.packageCostCents / 100).toFixed(2))
    setSize(m.packageSize.toString())
    setUnit(m.packageUnit)
    setSupplier(m.supplier ?? '')
    setNotes(m.notes ?? '')
    setEditId(m.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !size || !unit) return
    setSubmitting(true)
    setError(null)

    const payload: any = {
      name: name.trim(),
      packageCostCents: cost,
      packageSize: size,
      packageUnit: unit,
      supplier,
      notes,
    }

    try {
      if (editId) {
        payload.id = editId
        const res = await fetch('/api/admin/materials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json.error) {
          setError(json.error)
        } else {
          setMaterials((prev) =>
            prev.map((m) => (m.id === editId ? json.data : m)),
          )
          resetForm()
        }
      } else {
        const res = await fetch('/api/admin/materials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json.error) {
          setError(json.error)
        } else {
          setMaterials((prev) =>
            [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name)),
          )
          resetForm()
        }
      }
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this material?')) return
    try {
      const res = await fetch('/api/admin/materials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (json.error) {
        setError(json.error)
      } else if (json.data?.deactivated) {
        setMaterials((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isActive: false } : m)),
        )
      } else {
        setMaterials((prev) => prev.filter((m) => m.id !== id))
      }
    } catch {
      setError('Failed to delete')
    }
  }

  function costPerUnit(m: Material): string {
    const perUnit = m.packageCostCents / 100 / m.packageSize
    return perUnit < 0.01 ? `$${perUnit.toFixed(4)}` : `$${perUnit.toFixed(2)}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-brown/60">
          Raw materials Melly buys — used in recipes to calculate cost per product.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary text-sm"
          >
            + Add Material
          </button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            {editId ? 'Edit Material' : 'New Material'}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-sm font-medium text-brand-brown">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g. Shea Butter"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-brown">
                Package Cost ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="input"
                placeholder="12.99"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-brown">
                Package Size *
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="input flex-1"
                  placeholder="16"
                  required
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="input w-28"
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-brand-brown">
                Supplier
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="input"
                placeholder="Amazon, Bramble Berry, etc."
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-sm font-medium text-brand-brown">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                placeholder="Any extra info"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {submitting ? 'Saving...' : editId ? 'Save Changes' : 'Add Material'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Materials table */}
      {materials.length === 0 ? (
        <p className="text-sm text-brand-brown/50">
          No materials yet. Add some raw materials to start building recipes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-warm/40 text-left text-xs font-medium uppercase tracking-wider text-brand-brown/50">
                <th className="py-2 pr-4">Material</th>
                <th className="py-2 pr-4">Package</th>
                <th className="py-2 pr-4">Cost</th>
                <th className="py-2 pr-4">Cost/Unit</th>
                <th className="py-2 pr-4">Supplier</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-brand-warm/20 ${
                    !m.isActive ? 'opacity-40' : ''
                  }`}
                >
                  <td className="py-2 pr-4 font-medium text-brand-dark">
                    {m.name}
                  </td>
                  <td className="py-2 pr-4 text-brand-brown/70">
                    {m.packageSize} {UNIT_OPTIONS.find((u) => u.value === m.packageUnit)?.label ?? m.packageUnit}
                  </td>
                  <td className="py-2 pr-4 text-brand-brown/70">
                    ${(m.packageCostCents / 100).toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-brand-brown/70">
                    {costPerUnit(m)}/{m.packageUnit}
                  </td>
                  <td className="py-2 pr-4 text-brand-brown/50">
                    {m.supplier || '—'}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => startEdit(m)}
                      className="text-xs text-brand-terra hover:underline mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
