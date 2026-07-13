'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SM_OrderStatus } from '@prisma/client'
import {
  type OrderFilters,
  STATUS_OPTIONS,
  FULFILLMENT_OPTIONS,
  PAYMENT_OPTIONS,
  RANGE_OPTIONS,
  filtersToParams,
  describeActiveFilters,
  filtersEqual,
} from '@/app/lib/order-views'
import { parseVariantScent } from '@/app/lib/variant-name'
import {
  type OrderViewRow,
  createOrderView,
  deleteOrderView,
  setOrdersStatus,
} from '@/app/lib/actions/order-views'

type OrderRow = {
  id: string
  orderNumber: number
  customerName: string
  customerEmail: string
  items: { productName: string; variantName: string; quantity: number }[]
  fulfillment: 'SHIP' | 'PICKUP' | 'HOST_DELIVERY'
  status: SM_OrderStatus
  paymentMethod: string
  totalCents: number
  campaignId: string | null
  createdAt: string
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function statusPill(status: string): string {
  if (status === 'PAID' || status === 'PROCESSING') return 'bg-green-100 text-green-700'
  if (status === 'SHIPPED' || status === 'DELIVERED') return 'bg-blue-100 text-blue-700'
  if (status === 'READY_FOR_PICKUP' || status === 'PICKED_UP') return 'bg-amber-100 text-amber-700'
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

function paymentLabel(pm: string): string {
  if (pm === 'STRIPE_CARD') return 'Card'
  if (pm === 'MANUAL') return 'Manual'
  if (pm.startsWith('SQUARE')) return 'Square'
  return pm
}

// Item lines with the scent surfaced (matches the order-detail treatment).
function itemsText(items: OrderRow['items']): { main: string; scents: string[] } {
  const main = items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')
  const scents = items
    .map((i) => parseVariantScent(i.variantName))
    .filter((s) => s && s.toLowerCase() !== 'standard')
  return { main, scents: Array.from(new Set(scents)) }
}

const BULK_ACTIONS: { status: SM_OrderStatus; label: string }[] = [
  { status: 'PAID', label: 'Mark Paid' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'CANCELLED', label: 'Cancel' },
]

export default function OrdersClient({
  rows,
  views,
  filters,
  page,
  pageSize,
  totalCount,
}: {
  rows: OrderRow[]
  views: OrderViewRow[]
  filters: OrderFilters
  page: number
  pageSize: number
  totalCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState(filters.q ?? '')

  const activeChips = describeActiveFilters(filters)
  const activeView = views.find((v) => filtersEqual(v.filters, filters))
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function go(next: OrderFilters) {
    const qs = filtersToParams(next).toString()
    startTransition(() => router.push(qs ? `/admin/orders?${qs}` : '/admin/orders'))
  }

  function goPage(p: number) {
    const params = filtersToParams(filters)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    startTransition(() => router.push(qs ? `/admin/orders?${qs}` : '/admin/orders'))
  }

  // Single-select helpers: '' clears the dimension.
  const setStatus = (v: string) => go({ ...filters, status: v ? [v] : undefined })
  const setFulfillment = (v: string) => go({ ...filters, fulfillment: v ? [v] : undefined })
  const setPayment = (v: string) => go({ ...filters, payment: v ? [v] : undefined })
  const setCampaign = (v: string) =>
    go({ ...filters, campaign: v === 'storefront' || v === 'campaign' ? v : undefined })
  const setRange = (v: string) =>
    go({ ...filters, range: v === 'all' ? undefined : (v as OrderFilters['range']) })

  function clearChip(key: string) {
    const next: OrderFilters = { ...filters }
    if (key === 'date') {
      delete next.range
      delete next.from
      delete next.to
      delete next.dateField
    } else {
      delete (next as Record<string, unknown>)[key]
    }
    go(next)
  }

  function submitSearch() {
    go({ ...filters, q: search.trim() || undefined })
  }

  async function changeStatus(ids: string[], status: SM_OrderStatus) {
    // Confirm destructive/side-effecting changes: cancel/refund (irreversible +
    // now issues a real refund + restocks), SHIPPED (emails every customer), or
    // any bulk change across >1 order.
    const emails = status === 'SHIPPED'
    const destructive = status === 'CANCELLED' || status === 'REFUNDED'
    if (destructive || emails || ids.length > 1) {
      const n = ids.length
      const suffix = emails ? ' This emails a shipping notice to each customer.' : ''
      if (!confirm(`Set ${n} order${n > 1 ? 's' : ''} to ${status.toLowerCase()}?${suffix}`)) return
    }
    setBusy(true)
    const res = await setOrdersStatus(ids, status)
    setBusy(false)
    if (!res.ok) {
      alert(res.error)
      return
    }
    setSelected(new Set())
    router.refresh()
  }

  async function saveView() {
    const name = window.prompt('Name this view (e.g. "Big pickup orders"):')?.trim()
    if (!name) return
    setBusy(true)
    const res = await createOrderView({ name, filters })
    setBusy(false)
    if (!res.ok) alert(res.error)
    else router.refresh()
  }

  async function removeView(id: string, name: string) {
    if (!confirm(`Delete the "${name}" view?`)) return
    setBusy(true)
    const res = await deleteOrderView(id)
    setBusy(false)
    if (!res.ok) alert(res.error)
    else router.refresh()
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
  }

  const exportHref = `/api/admin/orders/export?${filtersToParams(filters).toString()}`
  const inputCls =
    'rounded-lg border border-brand-warm/60 bg-white px-2.5 py-1.5 text-sm text-brand-dark min-h-[40px]'

  return (
    <div className={pending ? 'opacity-70 transition-opacity' : ''}>
      {/* Saved-view pills */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {views.map((v) => {
          const active = activeView?.id === v.id
          return (
            <span key={v.id} className="inline-flex items-center">
              <button
                onClick={() => go(v.filters)}
                className={`rounded-full px-3 py-1.5 text-sm min-h-[40px] transition-colors ${
                  active
                    ? 'bg-brand-terra/15 text-brand-terra ring-1 ring-brand-terra/30'
                    : 'bg-brand-cream text-brand-brown/70 hover:bg-brand-warm/40'
                }`}
              >
                {v.icon && <span className="mr-1">{v.icon}</span>}
                {v.name}
              </button>
              {!v.isSystem && (
                <button
                  onClick={() => removeView(v.id, v.name)}
                  title="Delete view"
                  className="ml-0.5 text-brand-brown/40 hover:text-red-600 text-xs px-1"
                >
                  ×
                </button>
              )}
            </span>
          )
        })}
        <button
          onClick={saveView}
          disabled={busy}
          className="rounded-full px-3 py-1.5 text-sm min-h-[40px] text-brand-terra hover:bg-brand-terra/10 disabled:opacity-50"
        >
          ＋ Save view
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
          onBlur={submitSearch}
          placeholder="Search name / email / #"
          className={`${inputCls} flex-1 min-w-[180px]`}
        />
        <select value={filters.status?.[0] ?? ''} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={filters.fulfillment?.[0] ?? ''} onChange={(e) => setFulfillment(e.target.value)} className={inputCls}>
          <option value="">All types</option>
          {FULFILLMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={filters.payment?.[0] ?? ''} onChange={(e) => setPayment(e.target.value)} className={inputCls}>
          <option value="">All payments</option>
          {PAYMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={filters.campaign ?? ''} onChange={(e) => setCampaign(e.target.value)} className={inputCls}>
          <option value="">All sources</option>
          <option value="storefront">Storefront</option>
          <option value="campaign">Fundraiser</option>
        </select>
        <select value={filters.range ?? 'all'} onChange={(e) => setRange(e.target.value)} className={inputCls}>
          {RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {filters.range === 'custom' && (
          <>
            <input
              type="date"
              value={filters.from ?? ''}
              onChange={(e) => go({ ...filters, from: e.target.value || undefined })}
              className={inputCls}
            />
            <input
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => go({ ...filters, to: e.target.value || undefined })}
              className={inputCls}
            />
          </>
        )}
        <a href={exportHref} className="rounded-lg border border-brand-warm/60 px-3 py-1.5 text-sm text-brand-brown hover:bg-brand-warm/30 min-h-[40px] inline-flex items-center">
          ⬇ Export CSV
        </a>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => clearChip(chip.key)}
              className="inline-flex items-center gap-1 rounded-full bg-brand-warm/40 px-2.5 py-1 text-xs text-brand-brown hover:bg-brand-warm/70"
            >
              {chip.label} <span className="text-brand-brown/50">×</span>
            </button>
          ))}
          <button onClick={() => go({})} className="text-xs text-brand-terra hover:underline">
            Clear all
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 rounded-lg bg-brand-terra/10 px-3 py-2">
          <span className="text-sm font-medium text-brand-dark">{selected.size} selected</span>
          {BULK_ACTIONS.map((a) => (
            <button
              key={a.status}
              onClick={() => changeStatus(Array.from(selected), a.status)}
              disabled={busy}
              className="rounded-full bg-white border border-brand-warm/60 px-2.5 py-1 text-xs text-brand-brown hover:bg-brand-warm/30 disabled:opacity-50"
            >
              {a.label}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} className="text-xs text-brand-brown/60 hover:underline ml-1">
            Clear
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-brand-brown/60">No orders match these filters.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-brand-warm/60">
            <table className="w-full text-sm">
              <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
                  </th>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Pay</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-warm/40 bg-white">
                {rows.map((o) => {
                  const it = itemsText(o.items)
                  return (
                    <tr key={o.id} className={selected.has(o.id) ? 'bg-brand-terra/5' : 'hover:bg-surface-muted'}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4" />
                      </td>
                      <td className="px-4 py-3 font-medium text-brand-dark">
                        <Link href={`/admin/orders/${o.id}`} className="hover:text-brand-terra">#{o.orderNumber}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-brand-dark">{o.customerName}</div>
                        <div className="text-xs text-brand-brown/50">{o.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-brand-brown/70 max-w-[220px]">
                        <div className="truncate">{it.main}</div>
                        {it.scents.length > 0 && (
                          <div className="text-xs font-medium text-brand-terra truncate">{it.scents.join(', ')}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.fulfillment === 'SHIP' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {o.fulfillment === 'SHIP' ? 'Ship' : o.fulfillment === 'PICKUP' ? 'Pickup' : 'Host'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-brand-brown/60">{paymentLabel(o.paymentMethod)}</td>
                      <td className="px-4 py-3 font-medium text-brand-dark tabular-nums">{money(o.totalCents)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={o.status}
                          disabled={busy}
                          onChange={(e) => changeStatus([o.id], e.target.value as SM_OrderStatus)}
                          className={`rounded-full px-2 py-1 text-xs font-medium border-0 cursor-pointer ${statusPill(o.status)}`}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-brand-brown/50">
                        {new Date(o.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / iPad card list */}
          <div className="md:hidden space-y-2">
            {rows.map((o) => {
              const it = itemsText(o.items)
              return (
                <div key={o.id} className={`card ${selected.has(o.id) ? 'ring-1 ring-brand-terra/40' : ''}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} className="h-4 w-4" />
                      <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-dark hover:text-brand-terra">
                        #{o.orderNumber}
                      </Link>
                    </label>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill(o.status)}`}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-sm text-brand-dark">{o.customerName}</div>
                  <div className="text-xs text-brand-brown/60">{it.main}</div>
                  {it.scents.length > 0 && (
                    <div className="text-xs font-medium text-brand-terra">{it.scents.join(', ')}</div>
                  )}
                  <div className="flex items-center justify-between mt-2 text-xs text-brand-brown/60">
                    <span>{o.fulfillment === 'SHIP' ? 'Ship' : o.fulfillment === 'PICKUP' ? 'Pickup' : 'Host'} · {paymentLabel(o.paymentMethod)}</span>
                    <span className="font-medium text-brand-dark tabular-nums">{money(o.totalCents)}</span>
                    <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-brand-brown/60">
                Page {page} of {totalPages} · {totalCount} orders
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page <= 1}
                  className="rounded-lg border border-brand-warm/60 px-3 py-1.5 disabled:opacity-40 hover:bg-brand-warm/30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-brand-warm/60 px-3 py-1.5 disabled:opacity-40 hover:bg-brand-warm/30"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
