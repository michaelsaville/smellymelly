'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoice } from '@/app/lib/actions/invoices'

type Line = { description: string; quantity: string; price: string }

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function InvoiceForm({
  initialName,
  initialEmail,
}: {
  initialName?: string
  initialEmail?: string
}) {
  const router = useRouter()
  const [customerName, setCustomerName] = useState(initialName ?? '')
  const [customerEmail, setCustomerEmail] = useState(initialEmail ?? '')
  const [notes, setNotes] = useState('')
  const [taxRatePct, setTaxRatePct] = useState('6')
  const [lines, setLines] = useState<Line[]>([{ description: '', quantity: '1', price: '' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function updateLine(i: number, key: keyof Line, value: string) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, [key]: value } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, { description: '', quantity: '1', price: '' }])
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))
  }

  const subtotalCents = lines.reduce(
    (s, l) => s + (parseInt(l.quantity) || 0) * Math.round((parseFloat(l.price) || 0) * 100),
    0,
  )
  const taxCents = Math.round(subtotalCents * ((parseFloat(taxRatePct) || 0) / 100))
  const totalCents = subtotalCents + taxCents

  async function submit() {
    setError('')
    setBusy(true)
    const res = await createInvoice({
      customerName,
      customerEmail: customerEmail || undefined,
      notes: notes || undefined,
      taxRatePct: parseFloat(taxRatePct) || 0,
      items: lines.map((l) => ({
        description: l.description,
        quantity: parseInt(l.quantity) || 1,
        unitCents: Math.round((parseFloat(l.price) || 0) * 100),
      })),
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.push(`/admin/invoices/${res.id}`)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">Customer name *</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">Customer email</label>
            <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" className="input" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wide text-brand-brown/50 px-1">
            <div className="col-span-6">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-3 text-right">Unit price</div>
            <div className="col-span-1" />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={l.description}
                onChange={(e) => updateLine(i, 'description', e.target.value)}
                placeholder="e.g. Custom gift set — 12 units"
                className="input col-span-12 sm:col-span-6"
              />
              <input
                value={l.quantity}
                onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                type="number"
                min="1"
                className="input col-span-4 sm:col-span-2 text-right"
              />
              <input
                value={l.price}
                onChange={(e) => updateLine(i, 'price', e.target.value)}
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input col-span-6 sm:col-span-3 text-right"
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="col-span-2 sm:col-span-1 text-red-500 hover:text-red-700 text-sm"
                aria-label="Remove line"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLine} className="btn-secondary text-sm mt-3">
          + Add line
        </button>
      </div>

      <div className="card space-y-3">
        <div>
          <label className="block text-xs text-brand-brown/60 mb-1">Notes (payment terms, etc.)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input resize-y" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-brand-brown/60">Tax rate %</label>
          <input value={taxRatePct} onChange={(e) => setTaxRatePct(e.target.value)} type="number" step="0.01" className="input w-24" />
        </div>
        <div className="border-t border-brand-warm/40 pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-brand-brown/70">Subtotal</span><span className="tabular-nums">{money(subtotalCents)}</span></div>
          <div className="flex justify-between"><span className="text-brand-brown/70">Tax</span><span className="tabular-nums">{money(taxCents)}</span></div>
          <div className="flex justify-between font-semibold text-brand-dark"><span>Total</span><span className="tabular-nums">{money(totalCents)}</span></div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-60">
        {busy ? 'Creating…' : 'Create invoice'}
      </button>
    </div>
  )
}
