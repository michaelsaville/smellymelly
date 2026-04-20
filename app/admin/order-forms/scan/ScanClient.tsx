'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

export interface VariantOption {
  variantId: string
  productName: string
  variantName: string
  priceCents: number
  stock: number
}

interface CustomerCandidate {
  id: string
  name: string
  email: string
  phone: string | null
  score: number
  reason: string
}

interface ExtractedItem {
  variantId: string
  quantity: number
  productName: string
  variantName: string
  priceCents: number
}

interface ScanResponse {
  customer: {
    name: string | null
    phone: string | null
    email: string | null
    roomOrAddress: string | null
    notes: string | null
  }
  items: ExtractedItem[]
  unmatched: Array<{ rawText: string; quantity: number }>
  confidence: 'high' | 'medium' | 'low'
  candidates: CustomerCandidate[]
  totals: { itemCount: number; subtotalCents: number }
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function ScanClient({ variantOptions }: { variantOptions: VariantOption[] }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScanResponse | null>(null)

  // Editable extraction state
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [custRoom, setCustRoom] = useState('')
  const [custNotes, setCustNotes] = useState('')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('new')
  const [items, setItems] = useState<ExtractedItem[]>([])

  const variantMap = useMemo(
    () => new Map(variantOptions.map((v) => [v.variantId, v])),
    [variantOptions],
  )

  function handleFile(f: File | null) {
    setFile(f)
    setError(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  async function runScan() {
    if (!file) return
    setScanning(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/order-forms/scan', {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Scan failed' }))
        throw new Error(err.error || 'Scan failed')
      }
      const data = (await res.json()) as ScanResponse
      setResult(data)
      setCustName(data.customer.name ?? '')
      setCustPhone(data.customer.phone ?? '')
      setCustEmail(data.customer.email ?? '')
      setCustRoom(data.customer.roomOrAddress ?? '')
      setCustNotes(data.customer.notes ?? '')
      setItems(data.items)
      // Auto-select best candidate if score is decisive.
      const best = data.candidates[0]
      if (best && best.score >= 0.6) {
        setSelectedCandidateId(best.id)
        setCustName(best.name)
        setCustEmail(best.email)
        if (best.phone) setCustPhone(best.phone)
      } else {
        setSelectedCandidateId('new')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  function updateQty(idx: number, qty: number) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(0, Math.round(qty)) } : it)),
    )
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addItem(variantId: string) {
    if (!variantId) return
    const v = variantMap.get(variantId)
    if (!v) return
    // If already in the list, bump the qty instead of duplicating.
    const existingIdx = items.findIndex((i) => i.variantId === variantId)
    if (existingIdx >= 0) {
      updateQty(existingIdx, items[existingIdx].quantity + 1)
      return
    }
    setItems((prev) => [
      ...prev,
      {
        variantId: v.variantId,
        quantity: 1,
        productName: v.productName,
        variantName: v.variantName,
        priceCents: v.priceCents,
      },
    ])
  }

  function pickCandidate(id: string) {
    setSelectedCandidateId(id)
    if (id === 'new') return
    const c = result?.candidates.find((c) => c.id === id)
    if (c) {
      setCustName(c.name)
      setCustEmail(c.email)
      if (c.phone) setCustPhone(c.phone)
    }
  }

  const liveItems = items.filter((i) => i.quantity > 0)
  const subtotal = liveItems.reduce((s, i) => s + i.priceCents * i.quantity, 0)

  async function submit() {
    setError(null)
    if (!custName.trim()) {
      setError('Customer name is required.')
      return
    }
    if (liveItems.length === 0) {
      setError('At least one line item with qty ≥ 1 is required.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/order-forms/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingCustomerId: selectedCandidateId === 'new' ? null : selectedCandidateId,
          customer: {
            name: custName.trim(),
            email: custEmail.trim().toLowerCase(),
            phone: custPhone.trim() || null,
          },
          items: liveItems.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          notes: [custRoom && `Drop-off at: ${custRoom}`, custNotes]
            .filter(Boolean)
            .join(' — ') || null,
          manualPaymentNote: 'Paper order form',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(err.error || 'Import failed')
      }
      const data = (await res.json()) as { orderId: string; orderNumber: number }
      router.push(`/admin/orders/${data.orderId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark">Scan Order Form</h1>
      <p className="mt-2 text-brand-brown/60">
        Upload a photo of a completed back page. Claude reads the handwriting and matches
        items to variants; you review and confirm before the order is created.
      </p>

      {/* Upload */}
      <div className="mt-6 card">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-brand-brown file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-brand-warm file:text-brand-brown file:font-medium hover:file:bg-brand-terra hover:file:text-white"
          />
          <button
            onClick={runScan}
            disabled={!file || scanning}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {scanning ? 'Scanning…' : 'Scan form'}
          </button>
        </div>
        {previewUrl && (
          <div className="mt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Form preview"
              className="max-h-80 rounded border border-brand-warm"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Confidence banner */}
          <div
            className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
              result.confidence === 'high'
                ? 'border-green-300 bg-green-50 text-green-800'
                : result.confidence === 'medium'
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-red-300 bg-red-50 text-red-800'
            }`}
          >
            <strong>Confidence: {result.confidence}.</strong>{' '}
            {result.confidence !== 'high'
              ? 'Double-check every line before confirming.'
              : 'Review and confirm when ready.'}
          </div>

          {/* Customer */}
          <div className="mt-6 card">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">
              Customer
            </h2>

            {result.candidates.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-brand-brown mb-2">
                  Match found in the database — pick one or create new:
                </div>
                <div className="space-y-2">
                  {result.candidates.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-start gap-3 rounded border p-3 cursor-pointer transition-colors ${
                        selectedCandidateId === c.id
                          ? 'border-brand-terra bg-brand-warm/30'
                          : 'border-brand-warm hover:border-brand-terra/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedCandidateId === c.id}
                        onChange={() => pickCandidate(c.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 text-sm">
                        <div className="font-medium text-brand-dark">{c.name}</div>
                        <div className="text-brand-brown/60">
                          {c.email}
                          {c.phone ? ` · ${c.phone}` : ''}
                        </div>
                        <div className="text-xs text-brand-brown/50 mt-0.5">
                          {Math.round(c.score * 100)}% · {c.reason}
                        </div>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 rounded border p-3 cursor-pointer transition-colors ${
                      selectedCandidateId === 'new'
                        ? 'border-brand-terra bg-brand-warm/30'
                        : 'border-brand-warm hover:border-brand-terra/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      checked={selectedCandidateId === 'new'}
                      onChange={() => pickCandidate('new')}
                    />
                    <div className="text-sm font-medium text-brand-dark">
                      + Create new customer
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-brand-brown/70 uppercase">Name</span>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-brand-brown/70 uppercase">Phone</span>
                <input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-brand-brown/70 uppercase">
                  Email{' '}
                  <span className="font-normal text-brand-brown/50 normal-case">
                    (leave blank for placeholder)
                  </span>
                </span>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-brand-brown/70 uppercase">
                  Room / Unit / Address
                </span>
                <input
                  type="text"
                  value={custRoom}
                  onChange={(e) => setCustRoom(e.target.value)}
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-brand-brown/70 uppercase">Notes</span>
                <input
                  type="text"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  className="input mt-1 w-full"
                />
              </label>
            </div>
          </div>

          {/* Items */}
          <div className="mt-6 card">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">
              Order Items ({liveItems.length})
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-warm text-xs uppercase text-brand-brown/60">
                    <th className="text-left py-2">Product</th>
                    <th className="text-left py-2">Scent / Size</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-center py-2 w-24">Qty</th>
                    <th className="text-right py-2">Subtotal</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={`${it.variantId}-${idx}`} className="border-b border-brand-warm/40">
                      <td className="py-2">{it.productName}</td>
                      <td className="py-2 text-brand-brown/70">{it.variantName}</td>
                      <td className="py-2 text-right">{dollars(it.priceCents)}</td>
                      <td className="py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={it.quantity}
                          onChange={(e) => updateQty(idx, Number(e.target.value))}
                          className="w-16 rounded border border-brand-warm px-2 py-1 text-center"
                        />
                      </td>
                      <td className="py-2 text-right font-medium">
                        {dollars(it.priceCents * it.quantity)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-brand-brown/40 hover:text-red-600"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-brand-brown/50">
                        No items extracted. Add manually below.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="py-3 text-right font-semibold text-brand-dark">
                      Subtotal
                    </td>
                    <td className="py-3 text-right font-semibold text-brand-dark">
                      {dollars(subtotal)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 flex gap-2 items-center">
              <span className="text-sm text-brand-brown/60">Add missing item:</span>
              <select
                onChange={(e) => {
                  addItem(e.target.value)
                  e.currentTarget.value = ''
                }}
                className="input flex-1 max-w-md"
                defaultValue=""
              >
                <option value="" disabled>
                  Pick a variant…
                </option>
                {variantOptions.map((v) => (
                  <option key={v.variantId} value={v.variantId}>
                    {v.productName} — {v.variantName} ({dollars(v.priceCents)})
                    {v.stock <= 0 ? ' [OUT]' : v.stock <= 5 ? ` [${v.stock} left]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {result.unmatched.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <div className="font-medium text-amber-900 mb-1">Unmatched lines from scan:</div>
                <ul className="list-disc pl-5 text-amber-800">
                  {result.unmatched.map((u, i) => (
                    <li key={i}>
                      qty {u.quantity}: {u.rawText}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 text-xs text-amber-700">
                  Add any of these manually using the dropdown above if they should be in the order.
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => {
                setResult(null)
                setItems([])
                handleFile(null)
              }}
              className="btn-secondary"
            >
              Start over
            </button>
            <button
              onClick={submit}
              disabled={saving || liveItems.length === 0 || !custName.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating order…' : 'Create draft order'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
