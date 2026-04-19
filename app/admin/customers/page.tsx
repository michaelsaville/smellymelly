import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import {
  type Segment,
  SEGMENT_LABELS,
  segmentWhere,
} from '@/app/lib/customer-segments'

export const dynamic = 'force-dynamic'

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function daysSince(date: Date | null): string {
  if (!date) return '—'
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

const SEGMENT_ORDER: Segment[] = [
  'all',
  'repeat',
  'big_spenders',
  'new',
  'dormant',
  'has_shipped',
  'pickup_only',
]

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; q?: string }>
}) {
  await requireAdmin()
  const { segment: segmentParam, q } = await searchParams
  const segment: Segment = SEGMENT_ORDER.includes(segmentParam as Segment)
    ? (segmentParam as Segment)
    : 'all'
  const search = q?.trim() ?? ''

  const where = segmentWhere(segment, search || undefined)
  const customers = await prisma.sM_Customer.findMany({
    where,
    orderBy: [{ totalSpentCents: 'desc' }, { lastOrderAt: 'desc' }],
    take: 200,
    include: {
      tags: { include: { tag: true } },
    },
  })

  const totalCount = await prisma.sM_Customer.count()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-dark">
            Customers
          </h1>
          <p className="text-sm text-brand-brown/60 mt-1">
            {totalCount} total · showing {customers.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form
        method="GET"
        className="card mb-6 flex flex-col gap-4 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="segment" value={segment} />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by name or email…"
          className="input flex-1"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
        {search && (
          <Link
            href={`/admin/customers?segment=${segment}`}
            className="btn-ghost"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="flex flex-wrap gap-2 mb-6">
        {SEGMENT_ORDER.map((s) => {
          const active = s === segment
          const href =
            s === 'all'
              ? search
                ? `/admin/customers?q=${encodeURIComponent(search)}`
                : '/admin/customers'
              : `/admin/customers?segment=${s}${search ? `&q=${encodeURIComponent(search)}` : ''}`
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-brand-terra text-white'
                  : 'bg-white border border-brand-warm/60 text-brand-brown/70 hover:bg-brand-warm/40'
              }`}
            >
              {SEGMENT_LABELS[s]}
            </Link>
          )
        })}
      </div>

      {customers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-brand-brown/60">
            {search
              ? 'No customers match that search.'
              : segment === 'all'
                ? 'No customers yet. They appear here automatically after the first order.'
                : 'No customers match this segment.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-warm/60">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Lifetime</th>
                <th className="px-4 py-3 text-right">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-warm/40 bg-white">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-brand-dark hover:text-brand-terra"
                    >
                      {c.name}
                    </Link>
                    <div className="text-xs text-brand-brown/50">{c.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.orderCount}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-brand-dark">
                    {money(c.totalSpentCents)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-brown/50">
                    {daysSince(c.lastOrderAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
