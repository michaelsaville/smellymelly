'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Scent = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

export function ScentManager({ initialScents }: { initialScents: Scent[] }) {
  const router = useRouter()
  const [scents, setScents] = useState(initialScents)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function addScent(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)

    const res = await fetch('/api/admin/scents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const json = await res.json()

    if (json.error) {
      setError(json.error)
    } else {
      setScents([...scents, json.data])
      setNewName('')
    }
    setAdding(false)
  }

  async function deleteScent(id: string) {
    const res = await fetch('/api/admin/scents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setScents(scents.filter((s) => s.id !== id))
    }
  }

  async function toggleActive(scent: Scent) {
    const res = await fetch('/api/admin/scents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: scent.id, isActive: !scent.isActive }),
    })
    if (res.ok) {
      setScents(
        scents.map((s) =>
          s.id === scent.id ? { ...s, isActive: !s.isActive } : s,
        ),
      )
    }
  }

  return (
    <div className="mt-6 max-w-xl space-y-6">
      {/* Add scent form */}
      <form onSubmit={addScent} className="card flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-brand-brown">
            New Scent
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input"
            placeholder="e.g., Lavender, Vanilla Bean, Ocean Breeze"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {adding ? 'Adding...' : 'Add'}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Scent list */}
      <div className="card">
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-dark">
          All Scents ({scents.length})
        </h2>

        {scents.length === 0 ? (
          <p className="text-sm text-brand-brown/50">
            No scents yet. Add your first one above!
          </p>
        ) : (
          <ul className="divide-y divide-brand-warm/40">
            {scents.map((scent) => (
              <li
                key={scent.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-medium ${
                      scent.isActive
                        ? 'text-brand-dark'
                        : 'text-brand-brown/40 line-through'
                    }`}
                  >
                    {scent.name}
                  </span>
                  {!scent.isActive && (
                    <span className="rounded bg-brand-warm px-1.5 py-0.5 text-xs text-brand-brown/60">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(scent)}
                    className="text-xs text-brand-brown/60 hover:text-brand-terra"
                  >
                    {scent.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => deleteScent(scent.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
