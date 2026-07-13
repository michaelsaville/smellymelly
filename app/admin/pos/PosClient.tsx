'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPosSale } from '@/app/lib/actions/pos'

interface PosVariant {
  id: string
  label: string // product name
  sublabel: string // variant name
  scent: string | null
  priceCents: number
  stock: number
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function PosClient({
  variants,
  taxRate,
}: {
  variants: PosVariant[]
  taxRate: number
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [taxable, setTaxable] = useState(true)
  const [paymentNote, setPaymentNote] = useState('Cash')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ orderNumber: number } | null>(null)

  const vMap = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return variants
    return variants.filter((v) =>
      [v.label, v.sublabel, v.scent ?? ''].join(' ').toLowerCase().includes(q),
    )
  }, [variants, search])

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
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      {/* Catalog */}
      <div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products, scents…"
          className="input w-full mb-3"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filtered.map((v) => {
            const inCart = cart[v.id] ?? 0
            const out = v.stock <= 0
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => add(v)}
                disabled={out || inCart >= v.stock}
                className={`relative rounded-xl border p-3 text-left transition-colors min-h-[76px] ${
                  out
                    ? 'border-brand-warm/40 bg-surface-muted opacity-50'
                    : 'border-brand-warm/60 bg-white hover:border-brand-terra active:bg-brand-warm/40'
                }`}
              >
                {inCart > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-brand-terra px-1 text-xs font-bold text-white">
                    {inCart}
                  </span>
                )}
                <div className="text-sm font-medium text-brand-dark leading-tight line-clamp-2">
                  {v.label}
                </div>
                <div className="text-xs text-brand-brown/50 line-clamp-1">{v.sublabel}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-semibold text-brand-terra">{money(v.priceCents)}</span>
                  <span className={`text-[11px] ${v.stock <= 5 ? 'text-amber-600' : 'text-brand-brown/40'}`}>
                    {v.stock} left
                  </span>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-brand-brown/50 py-6 text-center">
              No products match “{search}”.
            </p>
          )}
        </div>
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
                    <div className="font-medium text-brand-dark truncate">{l.v.label}</div>
                    <div className="text-xs text-brand-brown/50 truncate">{l.v.sublabel}</div>
                  </div>
                  <div className="flex items-center rounded-lg border border-brand-warm/60">
                    <button
                      type="button"
                      onClick={() => setQty(l.v.id, l.qty - 1)}
                      className="px-2 py-1 text-brand-brown"
                      aria-label="Decrease"
                    >
                      −
                    </button>
                    <span className="w-6 text-center tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(l.v.id, l.qty + 1)}
                      disabled={l.qty >= l.v.stock}
                      className="px-2 py-1 text-brand-brown disabled:opacity-30"
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
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
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
    </div>
  )
}
