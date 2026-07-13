'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPosSale } from '@/app/lib/actions/pos'

interface PosVariant {
  id: string
  productId: string
  product: string // product name = the item "type"
  category: string | null
  scent: string // parsed; '' when the variant has no scent
  size: string // parsed; '' when the variant has no size
  priceCents: number
  stock: number
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function sizeWeight(size: string): number {
  const m = size.match(/^(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : Number.POSITIVE_INFINITY
}

function variantLabel(v: PosVariant): string {
  return [v.scent, v.size].filter(Boolean).join(' · ') || 'Standard'
}

type SizeGroup = { size: string; variants: PosVariant[] }
type ProductGroup = { productId: string; product: string; category: string | null; sizes: SizeGroup[] }

export default function PosClient({
  variants,
  taxRate,
  hideOutOfStock: hideInitial,
}: {
  variants: PosVariant[]
  taxRate: number
  hideOutOfStock: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [taxable, setTaxable] = useState(true)
  const [paymentNote, setPaymentNote] = useState('Cash')
  const [hideOOS, setHideOOS] = useState(hideInitial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ orderNumber: number } | null>(null)

  const vMap = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])

  // Filter by search + out-of-stock preference, then group product → size → scent.
  const groups = useMemo<ProductGroup[]>(() => {
    const q = search.trim().toLowerCase()
    const filtered = variants.filter((v) => {
      if (hideOOS && v.stock <= 0) return false
      if (!q) return true
      return [v.product, v.scent, v.size, v.category ?? ''].join(' ').toLowerCase().includes(q)
    })

    const byProduct = new Map<string, ProductGroup>()
    for (const v of filtered) {
      let g = byProduct.get(v.productId)
      if (!g) {
        g = { productId: v.productId, product: v.product, category: v.category, sizes: [] }
        byProduct.set(v.productId, g)
      }
      let sg = g.sizes.find((s) => s.size === v.size)
      if (!sg) {
        sg = { size: v.size, variants: [] }
        g.sizes.push(sg)
      }
      sg.variants.push(v)
    }
    // Sort sizes within each product by weight (2oz before 8oz; sizeless last).
    for (const g of byProduct.values()) {
      g.sizes.sort((a, b) => sizeWeight(a.size) - sizeWeight(b.size))
    }
    return Array.from(byProduct.values())
  }, [variants, search, hideOOS])

  const lines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ v: vMap.get(id)!, qty }))
        .filter((l) => l.v),
    [cart, vMap],
  )

  const subtotal = lines.reduce((s, l) => s + l.v.priceCents * l.qty, 0)
  const tax = taxable ? Math.round(subtotal * taxRate) : 0
  const total = subtotal + tax

  function add(v: PosVariant) {
    setError(null)
    setCart((prev) => {
      const cur = prev[v.id] ?? 0
      if (cur >= v.stock) return prev // don't exceed stock
      return { ...prev, [v.id]: cur + 1 }
    })
  }

  function setQty(id: string, qty: number) {
    const v = vMap.get(id)
    const capped = Math.max(0, Math.min(qty, v?.stock ?? qty))
    setCart((prev) => ({ ...prev, [id]: capped }))
  }

  async function toggleHideOOS(next: boolean) {
    setHideOOS(next)
    // Persist the preference; best-effort so the toggle stays snappy.
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posHideOutOfStock: next }),
      })
    } catch {
      // Non-fatal — the toggle still works for this session.
    }
  }

  async function complete() {
    if (lines.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const res = await createPosSale({
        items: lines.map((l) => ({ variantId: l.v.id, quantity: l.qty })),
        taxable,
        paymentNote,
      })
      if (!res.ok) {
        setError(res.error)
        setBusy(false)
        return
      }
      setDone({ orderNumber: res.orderNumber })
    } catch {
      setError('Could not complete the sale. Please try again.')
      setBusy(false)
    }
  }

  function newSale() {
    setCart({})
    setSearch('')
    setDone(null)
    setError(null)
    setBusy(false)
    router.refresh() // pull fresh stock counts
  }

  if (done) {
    return (
      <div className="card max-w-md mx-auto text-center py-10">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-3">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-brand-dark">Sale recorded</h2>
        <p className="mt-1 text-sm text-brand-brown/60">
          Order #{done.orderNumber} · {money(total)} · stock updated
        </p>
        <button onClick={newSale} className="btn-primary mt-6">
          New Sale
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] pb-24 lg:pb-0">
      {/* Catalog */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, scents…"
            className="input w-full sm:flex-1"
          />
          <label className="flex items-center gap-2 text-sm text-brand-brown/80 whitespace-nowrap">
            <input
              type="checkbox"
              checked={hideOOS}
              onChange={(e) => toggleHideOOS(e.target.checked)}
              className="h-4 w-4 rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
            />
            Hide out of stock
          </label>
        </div>

        {groups.length === 0 ? (
          <p className="text-sm text-brand-brown/50 py-8 text-center">
            {search ? `No products match “${search}”.` : 'No products to show.'}
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.productId} className="rounded-xl border border-brand-warm/50 bg-white p-3">
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="font-display text-base font-semibold text-brand-dark">{g.product}</h3>
                  {g.category && (
                    <span className="text-[11px] uppercase tracking-wide text-brand-brown/40">{g.category}</span>
                  )}
                </div>
                <div className="space-y-3">
                  {g.sizes.map((sg) => (
                    <div key={sg.size || '_'}>
                      {sg.size && (
                        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-brand-brown/50">
                          {sg.size}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {sg.variants.map((v) => {
                          const inCart = cart[v.id] ?? 0
                          const out = v.stock <= 0
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => add(v)}
                              disabled={out || inCart >= v.stock}
                              className={`relative min-h-[52px] rounded-lg border px-3 py-2 text-left transition-colors ${
                                out
                                  ? 'border-brand-warm/40 bg-surface-muted opacity-50'
                                  : 'border-brand-warm/60 bg-white hover:border-brand-terra active:bg-brand-warm/40'
                              }`}
                            >
                              {inCart > 0 && (
                                <span className="absolute -top-2 -right-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-terra px-1 text-[11px] font-bold text-white">
                                  {inCart}
                                </span>
                              )}
                              <div className="text-sm font-medium text-brand-dark leading-tight">
                                {v.scent || 'Standard'}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                                <span className="font-semibold text-brand-terra">{money(v.priceCents)}</span>
                                <span className={out ? 'text-red-500' : v.stock <= 5 ? 'text-amber-600' : 'text-brand-brown/40'}>
                                  {out ? 'out' : `${v.stock} left`}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Cart / tender */}
      <div className="lg:sticky lg:top-24 h-fit">
        <div className="card">
          <h2 className="font-display text-lg font-bold text-brand-dark mb-3">Sale</h2>

          {lines.length === 0 ? (
            <p className="text-sm text-brand-brown/50 py-4">Tap products to add them.</p>
          ) : (
            <div className="space-y-3 mb-3">
              {lines.map((l) => (
                <div key={l.v.id} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-brand-dark truncate">{l.v.product}</div>
                    <div className="text-xs text-brand-brown/50 truncate">{variantLabel(l.v)}</div>
                  </div>
                  <div className="flex items-center rounded-lg border border-brand-warm/60">
                    <button
                      type="button"
                      onClick={() => setQty(l.v.id, l.qty - 1)}
                      className="h-10 w-10 text-lg text-brand-brown"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(l.v.id, l.qty + 1)}
                      disabled={l.qty >= l.v.stock}
                      className="h-10 w-10 text-lg text-brand-brown disabled:opacity-30"
                      aria-label="Increase"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-16 text-right font-medium text-brand-dark tabular-nums">
                    {money(l.v.priceCents * l.qty)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-brand-warm/40 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-brand-brown">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(subtotal)}</span>
            </div>
            <label className="flex items-center justify-between text-brand-brown/70">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={taxable}
                  onChange={(e) => setTaxable(e.target.checked)}
                  className="h-4 w-4 rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
                />
                Tax ({(taxRate * 100).toFixed(0)}%)
              </span>
              <span className="tabular-nums">{money(tax)}</span>
            </label>
            <div className="flex justify-between border-t border-brand-warm/40 pt-2 text-base font-semibold text-brand-dark">
              <span>Total</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-brand-brown mb-1">Payment</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {['Cash', 'Venmo', 'Cash App', 'Card'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentNote(m)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    paymentNote === m
                      ? 'bg-brand-terra text-white'
                      : 'bg-brand-warm/50 text-brand-brown hover:bg-brand-warm'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Tender note"
              className="input w-full text-sm"
            />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={complete}
            disabled={busy || lines.length === 0}
            className="btn-primary w-full mt-4 py-3 disabled:opacity-50"
          >
            {busy ? 'Recording…' : `Complete Sale · ${money(total)}`}
          </button>
        </div>
      </div>

      {/* Mobile sticky action bar — the cart panel stacks below the whole
          catalog on phones, so this keeps Complete Sale one tap away. */}
      {lines.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-brand-warm/60 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
          <button
            onClick={complete}
            disabled={busy}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
              {lines.reduce((n, l) => n + l.qty, 0)}
            </span>
            {busy ? 'Recording…' : `Complete Sale · ${money(total)}`}
          </button>
        </div>
      )}
    </div>
  )
}
