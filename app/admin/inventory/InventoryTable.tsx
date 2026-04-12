'use client'

import { useState } from 'react'

interface VariantRow {
  id: string
  productName: string
  scent: string | null
  category: string
  variantName: string
  sku: string | null
  stockQuantity: number
  lowStockAt: number
  priceCents: number
  costCents: number | null
}

export function InventoryTable({ variants }: { variants: VariantRow[] }) {
  const [adjusting, setAdjusting] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  async function handleAdjust(id: string) {
    const qty = parseInt(adjusting[id] ?? '', 10)
    if (isNaN(qty) || qty < 0) return
    setSaving((prev) => ({ ...prev, [id]: true }))

    try {
      await fetch(`/api/admin/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockQuantity: qty }),
      })
      window.location.reload()
    } catch {
      // fail silently
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-brand-warm/60">
      <table className="w-full text-sm">
        <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
          <tr>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Variant</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-center">Stock</th>
            <th className="px-4 py-3">Adjust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-warm/40 bg-white">
          {variants.map((v) => {
            const isLow = v.stockQuantity <= v.lowStockAt
            const isOut = v.stockQuantity === 0
            return (
              <tr key={v.id} className={`hover:bg-surface-muted ${isOut ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-brand-dark">{v.productName}</div>
                  {v.scent && <div className="text-xs text-brand-brown/50">{v.scent}</div>}
                </td>
                <td className="px-4 py-3 text-brand-brown/70">{v.variantName}</td>
                <td className="px-4 py-3 text-xs text-brand-brown/50">{v.sku ?? '—'}</td>
                <td className="px-4 py-3 text-brand-brown/70">{v.category}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-brand-dark'}`}>
                    {v.stockQuantity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={adjusting[v.id] ?? ''}
                      onChange={(e) =>
                        setAdjusting((prev) => ({ ...prev, [v.id]: e.target.value }))
                      }
                      placeholder={String(v.stockQuantity)}
                      className="w-20 rounded border border-brand-warm bg-white px-2 py-1 text-sm focus:border-brand-terra focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjust(v.id)}
                      disabled={saving[v.id] || !adjusting[v.id]}
                      className="rounded bg-brand-terra px-2 py-1 text-xs text-white hover:bg-brand-brown disabled:opacity-50"
                    >
                      {saving[v.id] ? '...' : 'Set'}
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
