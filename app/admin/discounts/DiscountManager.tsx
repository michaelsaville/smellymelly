'use client'

import { useState } from 'react'
import {
  createDiscount,
  updateDiscount,
  toggleDiscount,
  deleteDiscount,
  type DiscountInput,
} from '@/app/lib/actions/discounts'

type DiscountType = 'PERCENT' | 'FIXED'

interface CodeRow {
  id: string
  code: string
  type: DiscountType
  value: number
  isActive: boolean
  maxUses: number
  usedCount: number
  minSubtotalCents: number
  expiresAt: string | null
  notes: string | null
}

interface FormState {
  code: string
  type: DiscountType
  value: string // percent, or dollars for FIXED
  maxUses: string
  minSubtotal: string // dollars
  expiresAt: string // yyyy-mm-dd
  notes: string
}

const EMPTY_FORM: FormState = {
  code: '',
  type: 'PERCENT',
  value: '',
  maxUses: '',
  minSubtotal: '',
  expiresAt: '',
  notes: '',
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function describe(c: CodeRow) {
  const off = c.type === 'PERCENT' ? `${c.value}% off` : `${money(c.value)} off`
  const bits = [off]
  if (c.minSubtotalCents > 0) bits.push(`min ${money(c.minSubtotalCents)}`)
  if (c.maxUses > 0) bits.push(`${c.usedCount}/${c.maxUses} used`)
  else if (c.usedCount > 0) bits.push(`${c.usedCount} used`)
  return bits.join(' · ')
}

export default function DiscountManager({ codes }: { codes: CodeRow[] }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function startEdit(c: CodeRow) {
    setEditingId(c.id)
    setError(null)
    setForm({
      code: c.code,
      type: c.type,
      value: c.type === 'FIXED' ? (c.value / 100).toString() : c.value.toString(),
      maxUses: c.maxUses ? c.maxUses.toString() : '',
      minSubtotal: c.minSubtotalCents ? (c.minSubtotalCents / 100).toString() : '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      notes: c.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  async function submit() {
    setError(null)
    const valueNum = parseFloat(form.value)
    if (isNaN(valueNum) || valueNum <= 0) {
      setError('Enter a value greater than zero.')
      return
    }
    const payload: DiscountInput = {
      code: form.code,
      type: form.type,
      // FIXED is entered in dollars, stored in cents.
      value: form.type === 'FIXED' ? Math.round(valueNum * 100) : Math.round(valueNum),
      maxUses: form.maxUses ? parseInt(form.maxUses, 10) : 0,
      minSubtotalCents: form.minSubtotal ? Math.round(parseFloat(form.minSubtotal) * 100) : 0,
      expiresAt: form.expiresAt || null,
      notes: form.notes || null,
    }
    setBusy(true)
    try {
      const res = editingId
        ? await updateDiscount(editingId, payload)
        : await createDiscount(payload)
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.')
      } else {
        cancelEdit()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onToggle(c: CodeRow) {
    setBusy(true)
    try {
      await toggleDiscount(c.id, !c.isActive)
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(c: CodeRow) {
    if (!confirm(`Delete code "${c.code}"? This can't be undone.`)) return
    setBusy(true)
    try {
      await deleteDiscount(c.id)
      if (editingId === c.id) cancelEdit()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Create / edit form */}
      <div className="card">
        <h2 className="font-display text-lg font-bold text-brand-dark mb-4">
          {editingId ? 'Edit code' : 'New code'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">Code</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="SPRING10"
              className="input w-full uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as DiscountType })}
              className="input w-full"
            >
              <option value="PERCENT">Percent off</option>
              <option value="FIXED">Fixed amount off</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">
              {form.type === 'PERCENT' ? 'Percent (1–100)' : 'Amount ($)'}
            </label>
            <input
              type="number"
              min="0"
              step={form.type === 'PERCENT' ? '1' : '0.01'}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={form.type === 'PERCENT' ? '10' : '5.00'}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">
              Min. order ($, optional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.minSubtotal}
              onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })}
              placeholder="0.00"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">
              Max uses (optional, 0 = unlimited)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              placeholder="Unlimited"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">
              Expires (optional)
            </label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="input w-full"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-brand-brown mb-1">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Spring newsletter promo"
              className="input w-full"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create code'}
          </button>
          {editingId && (
            <button onClick={cancelEdit} disabled={busy} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Existing codes */}
      {codes.length === 0 ? (
        <p className="text-sm text-brand-brown/50">No promo codes yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-warm/60">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-warm/40 bg-white">
              {codes.map((c) => {
                const expired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()
                const maxed = c.maxUses > 0 && c.usedCount >= c.maxUses
                return (
                  <tr key={c.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3 font-mono font-semibold text-brand-dark">{c.code}</td>
                    <td className="px-4 py-3 text-brand-brown/70">
                      {describe(c)}
                      {c.notes && <div className="text-xs text-brand-brown/40">{c.notes}</div>}
                    </td>
                    <td className="px-4 py-3 text-brand-brown/70">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {!c.isActive ? (
                        <span className="inline-flex rounded-full bg-brand-warm/60 px-2 py-0.5 text-xs text-brand-brown/70">
                          Inactive
                        </span>
                      ) : expired ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Expired
                        </span>
                      ) : maxed ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Used up
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          onClick={() => startEdit(c)}
                          disabled={busy}
                          className="text-brand-terra hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onToggle(c)}
                          disabled={busy}
                          className="text-brand-brown/70 hover:underline"
                        >
                          {c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => onDelete(c)}
                          disabled={busy}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
