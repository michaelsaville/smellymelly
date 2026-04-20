'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Campaign {
  name: string
  slug: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  customerPriceCents: number
  mellyCutCents: number
  hostCutPerItemCents: number
  startsAt: string | null
  endsAt: string | null
  hostName: string
}

interface OrderItem {
  productName: string
  variantName: string
  quantity: number
}

interface Order {
  id: string
  orderNumber: number
  status: string
  customerName: string
  createdAt: string
  itemCount: number
  subtotalCents: number
  items: OrderItem[]
}

interface Stats {
  itemsSold: number
  raisedCents: number
  hostCutCents: number
  mellyTakeCents: number
}

interface Props {
  campaign: Campaign
  orders: Order[]
  stats: Stats
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  READY_FOR_PICKUP: 'bg-indigo-100 text-indigo-800',
  PICKED_UP: 'bg-gray-100 text-gray-700',
  DELIVERED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-red-100 text-red-700',
}

export function HostDashboard({ campaign, orders, stats }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Poll for new orders every 30 seconds so hosts can leave the page open at
  // the party and watch it tick up without refreshing.
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(t)
  }, [autoRefresh, router])

  return (
    <div className="min-h-screen bg-brand-warm/20">
      <header className="bg-gradient-to-br from-brand-brown to-brand-terra text-white">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="text-xs uppercase tracking-widest text-brand-warm/90">
            Host dashboard
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold">
            {campaign.name}
          </h1>
          <p className="mt-1 text-white/80 text-sm">
            Hi {campaign.hostName} · Campaign is{' '}
            <strong>{campaign.status}</strong>
          </p>
          <p className="mt-4 text-sm text-white/90">
            Customer pays <strong>{money(campaign.customerPriceCents)}</strong>{' '}
            per item — <strong>{money(campaign.hostCutPerItemCents)}</strong> of
            each goes to you, {money(campaign.mellyCutCents)} to Mel.
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-white/80">
            <Link
              href={`/party/${campaign.slug}`}
              target="_blank"
              rel="noopener"
              className="underline decoration-white/40 hover:decoration-white"
            >
              Open shopping page →
            </Link>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              auto-refresh every 30s
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <StatCard label="Orders" value={orders.length.toString()} />
          <StatCard label="Items" value={stats.itemsSold.toString()} />
          <StatCard
            label="Total raised"
            value={money(stats.raisedCents)}
          />
          <StatCard
            label="Your share"
            value={money(stats.hostCutCents)}
            hint={`Mel: ${money(stats.mellyTakeCents)}`}
            tone="green"
          />
        </div>

        {/* Orders */}
        <section className="bg-white rounded-lg border border-brand-warm/40">
          <div className="px-4 py-3 border-b border-brand-warm/40 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-brand-dark">
              Orders
            </h2>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="text-xs text-brand-terra hover:underline"
            >
              Refresh
            </button>
          </div>
          {orders.length === 0 ? (
            <p className="p-6 text-sm text-brand-brown/60 italic text-center">
              No orders yet. Share the shopping page link with friends &amp; family!
            </p>
          ) : (
            <ul className="divide-y divide-brand-warm/30">
              {orders.map((o) => {
                const expanded = expandedId === o.id
                return (
                  <li key={o.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : o.id)}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-brand-dark">
                            {o.customerName}
                          </span>
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[o.status] ?? 'bg-gray-100'}`}
                          >
                            {o.status}
                          </span>
                        </div>
                        <div className="text-xs text-brand-brown/60 mt-0.5">
                          #{o.orderNumber} ·{' '}
                          {new Date(o.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">
                          {money(o.subtotalCents)}
                        </div>
                        <div className="text-xs text-brand-brown/60 tabular-nums">
                          {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                        </div>
                      </div>
                      <span className="text-brand-brown/40 text-xs">
                        {expanded ? '▲' : '▼'}
                      </span>
                    </button>
                    {expanded && (
                      <ul className="mt-2 ml-0 space-y-1 text-sm border-t border-brand-warm/30 pt-2">
                        {o.items.map((i, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-3 text-brand-brown/80"
                          >
                            <span className="w-8 tabular-nums text-brand-brown/60">
                              ×{i.quantity}
                            </span>
                            <span>
                              {i.productName} · {i.variantName}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-brand-brown/50">
          This page is yours to keep open at the party. It ticks over on its own
          as orders arrive.
        </p>
      </main>
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
      className={`rounded-lg border p-3 ${tone === 'green' ? 'bg-green-50 border-green-200' : 'bg-white border-brand-warm/40'}`}
    >
      <div className="text-xs uppercase tracking-wider text-brand-brown/60">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-xl sm:text-2xl font-bold ${tone === 'green' ? 'text-green-800' : 'text-brand-dark'}`}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-brand-brown/60">{hint}</div>
      )}
    </div>
  )
}
