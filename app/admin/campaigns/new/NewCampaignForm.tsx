'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign, createHost } from '@/app/lib/actions/campaigns'

interface Host {
  id: string
  name: string
}

interface Variant {
  id: string
  name: string
  priceCents: number
  stockQuantity: number
}

interface Product {
  id: string
  name: string
  variants: Variant[]
}

interface Props {
  hosts: Host[]
  products: Product[]
}

function parseDollars(input: string): number | null {
  const n = Number(input.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function NewCampaignForm({ hosts: initialHosts, products }: Props) {
  const router = useRouter()
  const [hosts, setHosts] = useState(initialHosts)
  const [hostId, setHostId] = useState<string>(initialHosts[0]?.id ?? '')
  const [showNewHost, setShowNewHost] = useState(initialHosts.length === 0)
  const [newHostName, setNewHostName] = useState('')
  const [newHostEmail, setNewHostEmail] = useState('')
  const [newHostPhone, setNewHostPhone] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [customerPrice, setCustomerPrice] = useState('8.00')
  const [mellyCut, setMellyCut] = useState('6.00')
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(new Set())
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleVariant(id: string) {
    setSelectedVariants((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllForProduct(product: Product) {
    const ids = product.variants.map((v) => v.id)
    const allOn = ids.every((i) => selectedVariants.has(i))
    setSelectedVariants((prev) => {
      const next = new Set(prev)
      if (allOn) ids.forEach((i) => next.delete(i))
      else ids.forEach((i) => next.add(i))
      return next
    })
  }

  function handleAddHost() {
    setErr(null)
    const name = newHostName.trim()
    if (!name) {
      setErr('Host name required')
      return
    }
    startTransition(async () => {
      const res = await createHost({
        name,
        email: newHostEmail.trim() || undefined,
        phone: newHostPhone.trim() || undefined,
      })
      if (!res.ok) {
        setErr(res.error)
        return
      }
      const newHost = { id: res.id!, name }
      setHosts((h) => [...h, newHost].sort((a, b) => a.name.localeCompare(b.name)))
      setHostId(res.id!)
      setShowNewHost(false)
      setNewHostName('')
      setNewHostEmail('')
      setNewHostPhone('')
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const customerCents = parseDollars(customerPrice)
    const mellyCents = parseDollars(mellyCut)
    if (customerCents === null || customerCents <= 0) {
      setErr('Customer price must be a positive dollar amount')
      return
    }
    if (mellyCents === null || mellyCents < 0 || mellyCents > customerCents) {
      setErr("Melly's cut must be between $0 and the customer price")
      return
    }
    if (!hostId) {
      setErr('Pick a host (or add one)')
      return
    }
    if (selectedVariants.size === 0) {
      setErr('Pick at least one variant')
      return
    }
    startTransition(async () => {
      const res = await createCampaign({
        name,
        description: description || undefined,
        hostId,
        customerPriceCents: customerCents,
        mellyCutCents: mellyCents,
        variantIds: [...selectedVariants],
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
      })
      if (!res.ok) {
        setErr(res.error)
        return
      }
      router.push(`/admin/campaigns/${res.id}`)
    })
  }

  const hostCut =
    (parseDollars(customerPrice) ?? 0) - (parseDollars(mellyCut) ?? 0)
  const totalSelected = selectedVariants.size

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Basics */}
      <section className="card space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Basics
        </h2>
        <div>
          <label className="label">Campaign name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sarah's Spring Party"
            required
            className="input"
          />
          <p className="mt-1 text-xs text-brand-brown/60">
            URL slug is auto-generated from this.
          </p>
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A short note shown at the top of the campaign page."
            className="input"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Starts at (optional)</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Ends at (optional)</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </section>

      {/* Host */}
      <section className="card space-y-3">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Host
        </h2>
        {!showNewHost ? (
          <>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">Choose a host</label>
                <select
                  value={hostId}
                  onChange={(e) => setHostId(e.target.value)}
                  className="input"
                  disabled={hosts.length === 0}
                >
                  {hosts.length === 0 ? (
                    <option value="">— no hosts yet —</option>
                  ) : (
                    hosts.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowNewHost(true)}
                className="btn-secondary whitespace-nowrap"
              >
                + Add host
              </button>
            </div>
          </>
        ) : (
          <div className="rounded border border-brand-warm/40 bg-brand-warm/10 p-3 space-y-2">
            <div>
              <label className="label">Host name</label>
              <input
                type="text"
                value={newHostName}
                onChange={(e) => setNewHostName(e.target.value)}
                placeholder="Sarah Johnson"
                className="input"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label">Email (optional)</label>
                <input
                  type="email"
                  value={newHostEmail}
                  onChange={(e) => setNewHostEmail(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Phone (optional)</label>
                <input
                  type="tel"
                  value={newHostPhone}
                  onChange={(e) => setNewHostPhone(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddHost}
                disabled={isPending}
                className="btn-primary"
              >
                Save host
              </button>
              {hosts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowNewHost(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Pricing */}
      <section className="card space-y-3">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Pricing (per item)
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Customer pays</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-brand-brown/60">$</span>
              <input
                type="text"
                value={customerPrice}
                onChange={(e) => setCustomerPrice(e.target.value)}
                className="input pl-7"
                inputMode="decimal"
              />
            </div>
          </div>
          <div>
            <label className="label">Mel&apos;s cut</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-brand-brown/60">$</span>
              <input
                type="text"
                value={mellyCut}
                onChange={(e) => setMellyCut(e.target.value)}
                className="input pl-7"
                inputMode="decimal"
              />
            </div>
          </div>
          <div>
            <label className="label">Host keeps</label>
            <div className="input bg-green-50 font-mono tabular-nums text-green-800">
              ${(hostCut / 100).toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      {/* Variant picker */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Products &amp; scents
          </h2>
          <span className="text-sm text-brand-brown/60">
            {totalSelected} variant{totalSelected === 1 ? '' : 's'} selected
          </span>
        </div>
        <p className="text-sm text-brand-brown/60">
          Pick the exact product + scent combos available in this campaign.
        </p>
        {products.length === 0 ? (
          <p className="text-sm text-brand-brown/60 italic">
            No active products with variants yet.
          </p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => {
              const allOn = product.variants.every((v) => selectedVariants.has(v.id))
              const someOn = product.variants.some((v) => selectedVariants.has(v.id))
              return (
                <details
                  key={product.id}
                  className="rounded border border-brand-warm/40"
                  open={someOn}
                >
                  <summary className="cursor-pointer select-none px-3 py-2 flex items-center gap-3 hover:bg-brand-warm/10">
                    <input
                      type="checkbox"
                      checked={allOn}
                      ref={(el) => {
                        if (el) el.indeterminate = someOn && !allOn
                      }}
                      onChange={() => toggleAllForProduct(product)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                    <span className="font-medium text-brand-dark">{product.name}</span>
                    <span className="text-xs text-brand-brown/60">
                      {product.variants.length} variant{product.variants.length === 1 ? '' : 's'}
                      {someOn && ` · ${product.variants.filter((v) => selectedVariants.has(v.id)).length} selected`}
                    </span>
                  </summary>
                  <div className="px-3 pb-3 pl-10 grid gap-1 sm:grid-cols-2">
                    {product.variants.map((v) => (
                      <label
                        key={v.id}
                        className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-brand-warm/10 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVariants.has(v.id)}
                          onChange={() => toggleVariant(v.id)}
                          className="h-4 w-4"
                        />
                        <span className="flex-1 text-brand-dark">{v.name}</span>
                        <span className="text-xs text-brand-brown/60 tabular-nums">
                          retail ${(v.priceCents / 100).toFixed(2)}
                          {v.stockQuantity <= 0 && (
                            <span className="ml-1 text-red-600">· OOS</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </section>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
        >
          {isPending ? 'Creating…' : 'Create campaign (as DRAFT)'}
        </button>
      </div>
    </form>
  )
}
