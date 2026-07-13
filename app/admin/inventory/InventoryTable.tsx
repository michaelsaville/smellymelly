'use client'

import { useMemo, useState } from 'react'

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

type SortKey =
  | 'productName'
  | 'variantName'
  | 'sku'
  | 'category'
  | 'stockQuantity'

type SortDir = 'asc' | 'desc'

type StockFilter = 'all' | 'in' | 'low' | 'out'

const STOCK_LABEL: Record<StockFilter, string> = {
  all: 'All stock levels',
  in: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
}

function compareStrings(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null || a === '') return 1
  if (b === null || b === '') return -1
  return a.localeCompare(b)
}

export function InventoryTable({ variants }: { variants: VariantRow[] }) {
  // Local copy so stock edits update in place — no full-page reload that would
  // wipe the search/category/stock filters mid-restock.
  const [rows, setRows] = useState<VariantRow[]>(variants)
  const [adjusting, setAdjusting] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [errorId, setErrorId] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<SortKey>('stockQuantity')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')

  const categories = useMemo(() => {
    return Array.from(new Set(rows.map((v) => v.category))).sort()
  }, [rows])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter((v) => {
      if (categoryFilter && v.category !== categoryFilter) return false
      if (stockFilter === 'in' && v.stockQuantity <= v.lowStockAt) return false
      if (
        stockFilter === 'low' &&
        !(v.stockQuantity > 0 && v.stockQuantity <= v.lowStockAt)
      )
        return false
      if (stockFilter === 'out' && v.stockQuantity !== 0) return false
      if (q) {
        const haystack = [
          v.productName,
          v.variantName,
          v.sku ?? '',
          v.scent ?? '',
          v.category,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'stockQuantity') {
        cmp = a.stockQuantity - b.stockQuantity
      } else {
        cmp = compareStrings(a[sortKey], b[sortKey])
      }
      // Stable secondary sort: keep low-stock-first feel for ties.
      if (cmp === 0 && sortKey !== 'stockQuantity') {
        cmp = a.stockQuantity - b.stockQuantity
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [rows, search, categoryFilter, stockFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'stockQuantity' ? 'asc' : 'asc')
    }
  }

  function caret(key: SortKey) {
    if (sortKey !== key) return <span className="text-brand-brown/30">↕</span>
    return (
      <span className="text-brand-terra">{sortDir === 'asc' ? '↑' : '↓'}</span>
    )
  }

  function clearFilters() {
    setSearch('')
    setCategoryFilter('')
    setStockFilter('all')
  }

  const filtersActive =
    search.trim() !== '' || categoryFilter !== '' || stockFilter !== 'all'

  async function setStock(id: string, qty: number) {
    if (isNaN(qty) || qty < 0) return
    setSaving((prev) => ({ ...prev, [id]: true }))
    setErrorId(null)

    try {
      const res = await fetch(`/api/admin/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockQuantity: qty }),
      })
      if (!res.ok) throw new Error('save failed')
      // Optimistic in-place update — keeps filters/scroll position intact.
      setRows((prev) => prev.map((v) => (v.id === id ? { ...v, stockQuantity: qty } : v)))
      setAdjusting((prev) => ({ ...prev, [id]: '' }))
    } catch {
      // Surface the failure so a non-technical owner knows it didn't save.
      setErrorId(id)
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  function handleAdjust(id: string) {
    return setStock(id, parseInt(adjusting[id] ?? '', 10))
  }

  // Relative ±1 tap — mobile-friendly for receiving/selling a single unit.
  function handleDelta(v: VariantRow, delta: number) {
    return setStock(v.id, Math.max(0, v.stockQuantity + delta))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, variant, SKU, scent…"
          className="input flex-1 min-w-[220px] max-w-md"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as StockFilter)}
          className="input w-auto"
        >
          {(Object.keys(STOCK_LABEL) as StockFilter[]).map((k) => (
            <option key={k} value={k}>
              {STOCK_LABEL[k]}
            </option>
          ))}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-brand-brown/60 hover:text-brand-dark underline"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-brand-brown/50 ml-auto">
          {filteredSorted.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand-warm/60">
        <table className="w-full text-sm">
          <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
            <tr>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('productName')}
                  className="inline-flex items-center gap-1 hover:text-brand-dark"
                >
                  Product {caret('productName')}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('variantName')}
                  className="inline-flex items-center gap-1 hover:text-brand-dark"
                >
                  Variant {caret('variantName')}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('sku')}
                  className="inline-flex items-center gap-1 hover:text-brand-dark"
                >
                  SKU {caret('sku')}
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSort('category')}
                  className="inline-flex items-center gap-1 hover:text-brand-dark"
                >
                  Category {caret('category')}
                </button>
              </th>
              <th className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => toggleSort('stockQuantity')}
                  className="inline-flex items-center gap-1 hover:text-brand-dark"
                >
                  Stock {caret('stockQuantity')}
                </button>
              </th>
              <th className="px-4 py-3">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-warm/40 bg-white">
            {filteredSorted.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-brand-brown/50"
                >
                  {filtersActive
                    ? 'No variants match these filters.'
                    : 'No variants yet.'}
                </td>
              </tr>
            ) : (
              filteredSorted.map((v) => {
                const isLow = v.stockQuantity <= v.lowStockAt
                const isOut = v.stockQuantity === 0
                return (
                  <tr
                    key={v.id}
                    className={`hover:bg-surface-muted ${isOut ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand-dark">
                        {v.productName}
                      </div>
                      {v.scent && (
                        <div className="text-xs text-brand-brown/50">
                          {v.scent}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-brand-brown/70">
                      {v.variantName}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-brown/50">
                      {v.sku ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-brand-brown/70">
                      {v.category}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-medium ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-brand-dark'}`}
                      >
                        {v.stockQuantity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDelta(v, -1)}
                          disabled={saving[v.id] || v.stockQuantity <= 0}
                          aria-label="Decrease stock by 1"
                          className="h-11 w-11 flex-shrink-0 rounded border border-brand-warm text-lg text-brand-brown hover:bg-brand-warm disabled:opacity-40"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelta(v, 1)}
                          disabled={saving[v.id]}
                          aria-label="Increase stock by 1"
                          className="h-11 w-11 flex-shrink-0 rounded border border-brand-warm text-lg text-brand-brown hover:bg-brand-warm disabled:opacity-40"
                        >
                          +
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={adjusting[v.id] ?? ''}
                          onChange={(e) =>
                            setAdjusting((prev) => ({
                              ...prev,
                              [v.id]: e.target.value,
                            }))
                          }
                          placeholder={String(v.stockQuantity)}
                          className="w-16 rounded border border-brand-warm bg-white px-2 py-2 text-sm focus:border-brand-terra focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAdjust(v.id)}
                          disabled={saving[v.id] || !adjusting[v.id]}
                          className="min-h-[44px] rounded bg-brand-terra px-3 text-xs text-white hover:bg-brand-brown disabled:opacity-50"
                        >
                          {saving[v.id] ? '...' : 'Set'}
                        </button>
                      </div>
                      {errorId === v.id && (
                        <p className="mt-1 text-xs text-red-600">Couldn’t save — try again.</p>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
