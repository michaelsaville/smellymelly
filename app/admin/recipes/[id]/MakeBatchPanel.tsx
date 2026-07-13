'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { makeBatch } from '@/app/lib/actions/production'

type Variant = { id: string; name: string; stockQuantity: number }

export default function MakeBatchPanel({
  recipeId,
  yields,
  productName,
  variants,
}: {
  recipeId: string
  yields: number
  productName: string | null
  variants: Variant[]
}) {
  const router = useRouter()
  const [batches, setBatches] = useState('1')
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const batchNum = Math.max(0, parseInt(batches, 10) || 0)
  const willAdd = Math.max(1, yields) * batchNum

  if (!productName || variants.length === 0) {
    return (
      <div className="card mb-6 bg-brand-cream/40">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">Make a batch</h2>
        <p className="text-sm text-brand-brown/60">
          Link this recipe to a product (with variants) to restock finished
          inventory when you make a batch.
        </p>
      </div>
    )
  }

  async function run() {
    setBusy(true)
    setMsg(null)
    setError(null)
    const res = await makeBatch({ recipeId, variantId, batches: batchNum })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    const v = variants.find((x) => x.id === variantId)
    setMsg(`Added ${res.added} to ${v?.name ?? 'variant'} — now ${res.newStock} in stock.`)
    router.refresh()
  }

  return (
    <div className="card mb-6 bg-brand-cream/40">
      <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">Make a batch</h2>
      <p className="text-xs text-brand-brown/60 mb-4">
        One batch yields <strong>{yields}</strong> unit{yields === 1 ? '' : 's'}. Adds finished
        stock to the variant you choose ({productName}).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-brand-brown/60 mb-1">Batches</label>
          <input
            type="number"
            min={1}
            value={batches}
            onChange={(e) => setBatches(e.target.value)}
            className="input w-24"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-brand-brown/60 mb-1">Add stock to</label>
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="input w-full">
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} (have {v.stockQuantity})
              </option>
            ))}
          </select>
        </div>
        <button onClick={run} disabled={busy || batchNum < 1} className="btn-primary disabled:opacity-60">
          {busy ? 'Adding…' : `Add ${willAdd || 0} to stock`}
        </button>
      </div>

      {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
