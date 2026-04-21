'use client'

import { useState, useTransition, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

interface ExtractedItem {
  variantId: string
  quantity: number
  productName: string
  variantName: string
}

interface ExtractedBuyer {
  num: number
  name: string | null
  phone: string | null
  notes: string | null
  items: ExtractedItem[]
  subtotalCents: number
}

interface Unmatched {
  rawText: string
  quantity: number
  buyerNum: number | null
}

interface ScanResponse {
  campaignId: string
  customerPriceCents: number
  buyers: ExtractedBuyer[]
  unmatched: Unmatched[]
  confidence: 'high' | 'medium' | 'low'
}

/** Review shape after admin edits — one per buyer we intend to import. */
interface ReviewBuyer {
  num: number
  name: string
  phone: string
  email: string
  notes: string
  items: ExtractedItem[]
  subtotalCents: number
  skip: boolean
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const CONFIDENCE_TONE: Record<'high' | 'medium' | 'low', string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-red-100 text-red-800',
}

export function CampaignScanClient({
  campaignId,
  campaignName,
}: {
  campaignId: string
  campaignName: string
}) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [scan, setScan] = useState<ScanResponse | null>(null)
  const [reviewBuyers, setReviewBuyers] = useState<ReviewBuyer[]>([])
  const [importing, startImporting] = useTransition()
  const [importResult, setImportResult] = useState<{ count: number } | null>(null)

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setScan(null)
    setReviewBuyers([])
    setErr(null)
    setImportResult(null)
  }

  async function handleScan() {
    if (!file) return
    setScanning(true)
    setErr(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/scan`,
        { method: 'POST', body: fd },
      )
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? 'Scan failed')
        setScanning(false)
        return
      }
      const parsed = json as ScanResponse
      setScan(parsed)
      setReviewBuyers(
        parsed.buyers.map((b) => ({
          num: b.num,
          name: b.name ?? '',
          phone: b.phone ?? '',
          email: '',
          notes: b.notes ?? '',
          items: b.items,
          subtotalCents: b.subtotalCents,
          skip: false,
        })),
      )
    } catch {
      setErr('Network error — please try again.')
    }
    setScanning(false)
  }

  function updateBuyer(num: number, patch: Partial<ReviewBuyer>) {
    setReviewBuyers((prev) =>
      prev.map((b) => (b.num === num ? { ...b, ...patch } : b)),
    )
  }

  function updateItemQty(num: number, variantId: string, quantity: number) {
    const qty = Math.max(0, Math.floor(quantity))
    setReviewBuyers((prev) =>
      prev.map((b) => {
        if (b.num !== num) return b
        let items = b.items
        if (qty === 0) {
          items = b.items.filter((i) => i.variantId !== variantId)
        } else {
          items = b.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: qty } : i,
          )
        }
        const subtotalCents =
          items.reduce((s, i) => s + i.quantity, 0) *
          (scan?.customerPriceCents ?? 0)
        return { ...b, items, subtotalCents }
      }),
    )
  }

  async function handleImport() {
    if (!scan) return
    const payload = {
      buyers: reviewBuyers
        .filter((b) => !b.skip)
        .map((b) => ({
          name: b.name.trim(),
          phone: b.phone.trim() || null,
          email: b.email.trim() || null,
          notes: b.notes.trim() || null,
          items: b.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        })),
    }
    if (payload.buyers.length === 0) {
      setErr('All buyers are marked to skip.')
      return
    }
    setErr(null)
    startImporting(async () => {
      const res = await fetch(
        `/api/admin/campaigns/${campaignId}/import`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? 'Import failed')
        return
      }
      setImportResult({ count: json.createdCount ?? 0 })
      router.refresh()
    })
  }

  const keeping = reviewBuyers.filter((b) => !b.skip)
  const activeItems = keeping.reduce((s, b) => s + b.items.reduce((t, i) => t + i.quantity, 0), 0)
  const activeTotal = keeping.reduce((s, b) => s + b.subtotalCents, 0)

  if (importResult) {
    return (
      <div className="mt-8 card bg-green-50 border-green-200 text-center py-10">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="font-display text-xl font-semibold text-green-900">
          Imported {importResult.count} order{importResult.count === 1 ? '' : 's'}
        </h2>
        <p className="mt-2 text-sm text-green-800">
          All tagged with the <strong>{campaignName}</strong> campaign. The host
          dashboard will show them on next refresh.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a
            href={`/admin/campaigns/${campaignId}`}
            className="btn-primary"
          >
            Back to campaign
          </a>
          <button
            type="button"
            onClick={() => {
              setImportResult(null)
              setScan(null)
              setFile(null)
              setPreview(null)
              setReviewBuyers([])
            }}
            className="btn-secondary"
          >
            Scan another form
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Upload */}
      <section className="card space-y-3">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          1. Upload photo
        </h2>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFile}
          className="block w-full text-sm"
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Form preview"
            className="max-h-96 rounded border border-brand-warm/40 object-contain"
          />
        )}
        {file && !scan && (
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="btn-primary"
          >
            {scanning ? 'Claude is reading the form…' : 'Scan with Claude'}
          </button>
        )}
      </section>

      {/* Review */}
      {scan && (
        <>
          <section className="card">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-display text-lg font-semibold text-brand-dark">
                2. Review extracted buyers
              </h2>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_TONE[scan.confidence]}`}
              >
                confidence · {scan.confidence}
              </span>
            </div>
            <p className="mt-1 text-sm text-brand-brown/60">
              Every item is {money(scan.customerPriceCents)}. Edit names, phones
              and quantities inline; uncheck &ldquo;Import&rdquo; on any row
              that looks wrong.
            </p>

            {scan.unmatched.length > 0 && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-medium">
                  {scan.unmatched.length} cell
                  {scan.unmatched.length === 1 ? '' : 's'} couldn&apos;t be matched
                </div>
                <ul className="mt-1 list-disc pl-5 space-y-0.5">
                  {scan.unmatched.map((u, i) => (
                    <li key={i}>
                      {u.buyerNum !== null ? `Buyer ${u.buyerNum}: ` : ''}
                      qty {u.quantity} of &ldquo;{u.rawText}&rdquo;
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-amber-800">
                  Add these by hand on the affected buyer rows.
                </p>
              </div>
            )}
          </section>

          {reviewBuyers.length === 0 ? (
            <div className="card text-center py-8 text-brand-brown/60">
              No buyer rows detected on the form.
            </div>
          ) : (
            <div className="space-y-3">
              {reviewBuyers.map((b) => (
                <div
                  key={b.num}
                  className={`card space-y-3 ${b.skip ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-brand-terra text-white font-bold">
                      {b.num}
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!b.skip}
                        onChange={(e) => updateBuyer(b.num, { skip: !e.target.checked })}
                      />
                      Import this buyer
                    </label>
                    <div className="ml-auto font-mono tabular-nums text-brand-dark">
                      {b.items.reduce((s, i) => s + i.quantity, 0)} items · {money(b.subtotalCents)}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-brand-brown/60">
                        Name
                      </label>
                      <input
                        type="text"
                        value={b.name}
                        onChange={(e) => updateBuyer(b.num, { name: e.target.value })}
                        placeholder="required"
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-brand-brown/60">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={b.phone}
                        onChange={(e) => updateBuyer(b.num, { phone: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-brand-brown/60">
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={b.email}
                        onChange={(e) => updateBuyer(b.num, { email: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>

                  <ul className="divide-y divide-brand-warm/30 text-sm">
                    {b.items.map((item) => (
                      <li
                        key={item.variantId}
                        className="py-1.5 flex items-center gap-3"
                      >
                        <span className="flex-1 text-brand-dark truncate">
                          {item.productName}
                          <span className="text-brand-brown/60"> · {item.variantName}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateItemQty(b.num, item.variantId, item.quantity - 1)}
                            className="h-6 w-6 rounded border border-brand-warm/50 text-brand-brown disabled:opacity-30"
                            disabled={item.quantity <= 0}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQty(b.num, item.variantId, Number(e.target.value))
                            }
                            className="w-14 h-6 text-center rounded border border-brand-warm/50 tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => updateItemQty(b.num, item.variantId, item.quantity + 1)}
                            className="h-6 w-6 rounded border border-brand-warm/50 text-brand-brown"
                          >
                            +
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div>
                    <label className="text-xs uppercase tracking-wider text-brand-brown/60">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={b.notes}
                      onChange={(e) => updateBuyer(b.num, { notes: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card sticky bottom-4 z-10 shadow-md">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm text-brand-brown/80">
                <strong>{keeping.length}</strong> buyer{keeping.length === 1 ? '' : 's'} ·{' '}
                <strong>{activeItems}</strong> item{activeItems === 1 ? '' : 's'} ·{' '}
                <strong className="font-mono">{money(activeTotal)}</strong> total
              </div>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || keeping.length === 0}
                className="btn-primary disabled:opacity-50"
              >
                {importing
                  ? 'Creating orders…'
                  : `Import ${keeping.length} order${keeping.length === 1 ? '' : 's'}`}
              </button>
            </div>
            {err && (
              <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
                {err}
              </div>
            )}
          </div>
        </>
      )}

      {err && !scan && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}
    </div>
  )
}
