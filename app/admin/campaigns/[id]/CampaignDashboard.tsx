'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
  rotateHostToken,
} from '@/app/lib/actions/campaigns'

type Status = 'DRAFT' | 'ACTIVE' | 'CLOSED'

interface Variant {
  id: string
  productName: string
  variantName: string
  priceCents: number
  stockQuantity: number
}

interface Product {
  id: string
  name: string
  variants: Array<{
    id: string
    name: string
    priceCents: number
    stockQuantity: number
  }>
}

interface OrderRow {
  id: string
  orderNumber: number
  createdAt: string
  status: string
  customerName: string
  customerEmail: string
  subtotalCents: number
  itemCount: number
}

interface Campaign {
  id: string
  slug: string
  name: string
  description: string | null
  status: Status
  customerPriceCents: number
  mellyCutCents: number
  startsAt: string | null
  endsAt: string | null
  hostToken: string
  host: { id: string; name: string; email: string | null; phone: string | null }
  variants: Variant[]
  orders: OrderRow[]
}

interface Stats {
  itemsSold: number
  raisedCents: number
  hostCutCents: number
  mellyTakeCents: number
}

interface Props {
  origin: string
  campaign: Campaign
  products: Product[]
  stats: Stats
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function parseDollars(input: string): number | null {
  const n = Number(input.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60_000)
  return local.toISOString().slice(0, 16)
}

const STATUS_TONE: Record<Status, string> = {
  DRAFT: 'bg-brand-warm/30 text-brand-brown',
  ACTIVE: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
}

export function CampaignDashboard({ origin, campaign, products, stats }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Edit-form state
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description ?? '')
  const [customerPrice, setCustomerPrice] = useState(
    (campaign.customerPriceCents / 100).toFixed(2),
  )
  const [mellyCut, setMellyCut] = useState(
    (campaign.mellyCutCents / 100).toFixed(2),
  )
  const [startsAt, setStartsAt] = useState(toLocalDatetimeInput(campaign.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalDatetimeInput(campaign.endsAt))
  const [selectedVariants, setSelectedVariants] = useState<Set<string>>(
    new Set(campaign.variants.map((v) => v.id)),
  )

  const partyUrl = `${origin}/party/${campaign.slug}`
  const hostUrl = `${origin}/host/${campaign.hostToken}`

  function copy(text: string, label: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

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

  function handleSave() {
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
    if (selectedVariants.size === 0) {
      setErr('Pick at least one variant')
      return
    }
    startTransition(async () => {
      const res = await updateCampaign(campaign.id, {
        name,
        description: description || null,
        customerPriceCents: customerCents,
        mellyCutCents: mellyCents,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        variantIds: [...selectedVariants],
      })
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  function handleStatus(next: Status) {
    setErr(null)
    startTransition(async () => {
      const res = await setCampaignStatus(campaign.id, next)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      router.refresh()
    })
  }

  function handleRotate() {
    if (!confirm("Rotate the host link? The old link will stop working.")) return
    startTransition(async () => {
      const res = await rotateHostToken(campaign.id)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return
    startTransition(async () => {
      const res = await deleteCampaign(campaign.id)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      router.push('/admin/campaigns')
    })
  }

  const hostCutPerItem = campaign.customerPriceCents - campaign.mellyCutCents

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold text-brand-dark">
              {campaign.name}
            </h1>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[campaign.status]}`}
            >
              {campaign.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-brand-brown/60">
            Hosted by <span className="font-medium">{campaign.host.name}</span>
            {campaign.host.email && <> · {campaign.host.email}</>}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => handleStatus('ACTIVE')}
              disabled={isPending}
              className="btn-primary"
            >
              Activate
            </button>
          )}
          {campaign.status === 'ACTIVE' && (
            <button
              type="button"
              onClick={() => handleStatus('CLOSED')}
              disabled={isPending}
              className="btn-secondary"
            >
              Close campaign
            </button>
          )}
          {campaign.status === 'CLOSED' && (
            <button
              type="button"
              onClick={() => handleStatus('ACTIVE')}
              disabled={isPending}
              className="btn-secondary"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Share links */}
      <section className="card space-y-3">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-brand-brown/60">
          Share links
        </h2>
        <div className="space-y-2">
          <ShareRow
            label="Campaign URL (for customers)"
            url={partyUrl}
            copied={copied === 'party'}
            onCopy={() => copy(partyUrl, 'party')}
            visitLabel="Open public page →"
          />
          <ShareRow
            label="Host dashboard (magic link)"
            url={hostUrl}
            copied={copied === 'host'}
            onCopy={() => copy(hostUrl, 'host')}
            visitLabel="Preview host view →"
            extra={
              <button
                type="button"
                onClick={handleRotate}
                disabled={isPending}
                className="text-xs text-brand-brown/60 hover:text-brand-terra"
              >
                rotate
              </button>
            }
          />
        </div>
      </section>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Orders" value={campaign.orders.length.toString()} />
        <StatCard label="Items sold" value={stats.itemsSold.toString()} />
        <StatCard label="Total raised" value={money(stats.raisedCents)} />
        <StatCard
          label="Host cut"
          value={money(stats.hostCutCents)}
          hint={`Mel: ${money(stats.mellyTakeCents)}`}
          tone="green"
        />
      </div>

      {/* Edit section */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Details
          </h2>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary text-sm"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="btn-primary text-sm"
              >
                {isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {!editing ? (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Row label="Slug" value={`/party/${campaign.slug}`} mono />
            <Row
              label="Pricing (per item)"
              value={`${money(campaign.customerPriceCents)} → Mel ${money(campaign.mellyCutCents)} / Host ${money(hostCutPerItem)}`}
            />
            <Row
              label="Starts"
              value={campaign.startsAt ? new Date(campaign.startsAt).toLocaleString() : '—'}
            />
            <Row
              label="Ends"
              value={campaign.endsAt ? new Date(campaign.endsAt).toLocaleString() : '—'}
            />
            {campaign.description && (
              <div className="sm:col-span-2">
                <dt className="label">Description</dt>
                <dd className="whitespace-pre-wrap text-brand-dark">
                  {campaign.description}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input"
              />
            </div>
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
                  $
                  {(
                    ((parseDollars(customerPrice) ?? 0) -
                      (parseDollars(mellyCut) ?? 0)) /
                    100
                  ).toFixed(2)}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Starts at</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Ends at</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">
                Variants ({selectedVariants.size} selected)
              </label>
              <div className="space-y-2 max-h-80 overflow-y-auto rounded border border-brand-warm/40 p-2">
                {products.map((product) => {
                  const allOn = product.variants.every((v) =>
                    selectedVariants.has(v.id),
                  )
                  const someOn = product.variants.some((v) =>
                    selectedVariants.has(v.id),
                  )
                  return (
                    <details key={product.id} className="" open={someOn}>
                      <summary className="cursor-pointer select-none px-1 py-1 flex items-center gap-2 hover:bg-brand-warm/10 rounded">
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
                        <span className="font-medium text-brand-dark text-sm">
                          {product.name}
                        </span>
                      </summary>
                      <div className="pl-7 grid gap-1 sm:grid-cols-2">
                        {product.variants.map((v) => (
                          <label
                            key={v.id}
                            className="flex items-center gap-2 text-sm py-0.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedVariants.has(v.id)}
                              onChange={() => toggleVariant(v.id)}
                              className="h-4 w-4"
                            />
                            <span className="flex-1 text-brand-dark">
                              {v.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </details>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Orders list */}
      <section className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
          Orders ({campaign.orders.length})
        </h2>
        {campaign.orders.length === 0 ? (
          <p className="text-sm text-brand-brown/60 italic">
            No orders yet — share the campaign URL with the host.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-brand-brown/60">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Placed</th>
                  <th className="py-2 pl-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-warm/30">
                {campaign.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3 font-mono">
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="text-brand-terra hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{o.customerName}</td>
                    <td className="py-2 pr-3 tabular-nums">{o.itemCount}</td>
                    <td className="py-2 pr-3">{o.status}</td>
                    <td className="py-2 pr-3 text-brand-brown/70">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums">
                      {money(o.subtotalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <div className="pt-6 border-t border-brand-warm/30">
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || campaign.orders.length > 0}
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
          title={
            campaign.orders.length > 0
              ? 'Cannot delete campaigns with orders — close them instead.'
              : undefined
          }
        >
          Delete campaign
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={mono ? 'font-mono text-brand-dark' : 'text-brand-dark'}>
        {value}
      </dd>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'green'
}) {
  return (
    <div
      className={`card ${tone === 'green' ? 'bg-green-50 border-green-200' : ''}`}
    >
      <div className="text-xs uppercase tracking-wider text-brand-brown/60">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-2xl font-bold ${
          tone === 'green' ? 'text-green-800' : 'text-brand-dark'
        }`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-brand-brown/60">{hint}</div>
      )}
    </div>
  )
}

function ShareRow({
  label,
  url,
  copied,
  onCopy,
  visitLabel,
  extra,
}: {
  label: string
  url: string
  copied: boolean
  onCopy: () => void
  visitLabel: string
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs text-brand-brown/60">{label}</div>
        <div className="font-mono text-xs text-brand-dark truncate">{url}</div>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="btn-secondary text-xs whitespace-nowrap"
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="text-xs text-brand-terra hover:underline whitespace-nowrap"
      >
        {visitLabel}
      </a>
      {extra}
    </div>
  )
}
