'use client'

import { useEffect, useState, useMemo, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Item {
  variantId: string
  productName: string
  variantName: string
  imageUrl: string | null
  stockQuantity: number
}

interface Props {
  slug: string
  name: string
  description: string | null
  hostName: string
  customerPriceCents: number
  items: Item[]
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function cartKey(slug: string): string {
  return `sm_cart_party_${slug}`
}

function readCart(slug: string): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(cartKey(slug))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeCart(slug: string, cart: Record<string, number>) {
  localStorage.setItem(cartKey(slug), JSON.stringify(cart))
}

export function PartyShop({
  slug,
  name,
  description,
  hostName,
  customerPriceCents,
  items,
}: Props) {
  const router = useRouter()
  const [cart, setCart] = useState<Record<string, number>>({})
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCart(readCart(slug))
  }, [slug])

  function setQty(variantId: string, qty: number) {
    const clean = Math.max(0, Math.floor(qty))
    const next = { ...cart }
    if (clean <= 0) delete next[variantId]
    else next[variantId] = clean
    setCart(next)
    writeCart(slug, next)
  }

  const totalItems = useMemo(
    () => Object.values(cart).reduce((s, q) => s + q, 0),
    [cart],
  )
  const subtotalCents = totalItems * customerPriceCents

  const itemsById = useMemo(() => {
    const m = new Map<string, Item>()
    for (const i of items) m.set(i.variantId, i)
    return m
  }, [items])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (totalItems === 0) {
      setError('Your cart is empty.')
      return
    }
    if (!customerName.trim() || !customerEmail.trim()) {
      setError('Name and email are required.')
      return
    }

    const orderItems = Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([variantId, quantity]) => ({ variantId, quantity }))

    setSubmitting(true)
    try {
      const res = await fetch(`/api/party/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: customerName.trim(),
            email: customerEmail.trim(),
            phone: customerPhone.trim() || undefined,
          },
          items: orderItems,
          note: note.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to place order.')
        setSubmitting(false)
        return
      }
      // Clear cart on success and jump to the confirmation page.
      writeCart(slug, {})
      router.push(`/party/${slug}/thanks/${json.orderId}`)
    } catch {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-warm/20">
      {/* Hero */}
      <header className="bg-gradient-to-br from-brand-terra via-brand-terra to-brand-brown text-white">
        <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14">
          <div className="text-xs uppercase tracking-widest text-brand-warm/90">
            Smelly Melly fundraiser
          </div>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold">
            {name}
          </h1>
          <p className="mt-2 text-white/90">Hosted by {hostName}</p>
          {description && (
            <p className="mt-4 text-white/90 whitespace-pre-wrap">{description}</p>
          )}
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur">
            Every item is{' '}
            <span className="font-semibold">{money(customerPriceCents)}</span>
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Items */}
        <section className="bg-white rounded-lg border border-brand-warm/40 overflow-hidden">
          <h2 className="px-4 py-3 border-b border-brand-warm/40 font-display text-lg font-semibold text-brand-dark">
            Pick what you&apos;d like
          </h2>
          {items.length === 0 ? (
            <p className="p-6 text-sm text-brand-brown/60 italic">
              No items available — check back with the host.
            </p>
          ) : (
            <ul className="divide-y divide-brand-warm/30">
              {items.map((item) => {
                const qty = cart[item.variantId] ?? 0
                const oos = item.stockQuantity <= 0
                return (
                  <li
                    key={item.variantId}
                    className="flex items-center gap-3 p-3 sm:p-4"
                  >
                    <div className="w-16 h-16 flex-none rounded bg-brand-warm/20 overflow-hidden">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🛍️
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-brand-dark truncate">
                        {item.productName}
                      </div>
                      <div className="text-sm text-brand-brown/70 truncate">
                        {item.variantName}
                      </div>
                      {oos && (
                        <div className="text-xs text-red-600 mt-0.5">
                          Out of stock
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQty(item.variantId, qty - 1)}
                        disabled={qty === 0}
                        className="h-8 w-8 rounded border border-brand-warm/50 text-brand-brown disabled:opacity-30"
                        aria-label="Decrease"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) =>
                          setQty(item.variantId, Number(e.target.value))
                        }
                        disabled={oos}
                        min={0}
                        max={item.stockQuantity}
                        className="w-14 h-8 text-center rounded border border-brand-warm/50 tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(item.variantId, qty + 1)}
                        disabled={oos || qty >= item.stockQuantity}
                        className="h-8 w-8 rounded border border-brand-warm/50 text-brand-brown disabled:opacity-30"
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Cart summary */}
        {totalItems > 0 && (
          <section className="bg-white rounded-lg border border-brand-warm/40 p-4">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-2">
              Your order
            </h2>
            <ul className="text-sm divide-y divide-brand-warm/30">
              {Object.entries(cart)
                .filter(([, qty]) => qty > 0)
                .map(([variantId, qty]) => {
                  const item = itemsById.get(variantId)
                  if (!item) return null
                  return (
                    <li
                      key={variantId}
                      className="py-2 flex items-center gap-3"
                    >
                      <span className="tabular-nums w-8 text-brand-brown/70">
                        ×{qty}
                      </span>
                      <span className="flex-1 truncate">
                        <span className="text-brand-dark">{item.productName}</span>
                        <span className="text-brand-brown/60"> · {item.variantName}</span>
                      </span>
                      <span className="tabular-nums text-brand-brown/70">
                        {money(qty * customerPriceCents)}
                      </span>
                    </li>
                  )
                })}
            </ul>
            <div className="mt-3 pt-3 border-t border-brand-warm/40 flex justify-between text-brand-dark font-semibold">
              <span>Total ({totalItems} item{totalItems === 1 ? '' : 's'})</span>
              <span className="tabular-nums">{money(subtotalCents)}</span>
            </div>
          </section>
        )}

        {/* Buyer info */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-brand-warm/40 p-4 space-y-3"
        >
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Your info
          </h2>
          <div>
            <label className="text-xs uppercase tracking-wider text-brand-brown/60">
              Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              className="input"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-brand-brown/60">
                Email
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="input"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-brand-brown/60">
                Phone (optional)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-brand-brown/60">
              Note for {hostName} (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="input"
            />
          </div>

          <div className="rounded bg-brand-warm/30 text-brand-brown text-sm p-3">
            <strong>How payment works:</strong> Mel will deliver your items to{' '}
            {hostName}. Bring cash, check, Venmo, or Cash App payment of{' '}
            <span className="font-mono">{money(subtotalCents)}</span> to them at
            the event.
          </div>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || totalItems === 0}
            className="btn-primary w-full disabled:opacity-50"
          >
            {submitting
              ? 'Placing order…'
              : totalItems === 0
                ? 'Pick items above first'
                : `Place order — ${money(subtotalCents)}`}
          </button>
        </form>

        <p className="text-center text-xs text-brand-brown/50">
          Part of{' '}
          <Link href="/" className="hover:text-brand-terra">
            Smelly Melly
          </Link>{' '}
          · Small-batch, made in Cumberland, Maryland
        </p>
      </main>
    </div>
  )
}
