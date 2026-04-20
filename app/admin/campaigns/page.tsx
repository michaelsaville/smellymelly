import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-brand-warm/30 text-brand-brown',
  ACTIVE: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
}

export default async function CampaignsListPage() {
  await requireAdmin()

  const campaigns = await prisma.sM_Campaign.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      host: { select: { id: true, name: true } },
      _count: { select: { variants: true, orders: true } },
    },
  })

  // Aggregate order totals per campaign in a single query
  const totals = await prisma.sM_Order.groupBy({
    by: ['campaignId'],
    where: {
      campaignId: { not: null },
      status: { notIn: ['CANCELLED', 'REFUNDED'] },
    },
    _sum: { subtotalCents: true },
  })
  const subtotalByCampaign = new Map(
    totals.map((t) => [t.campaignId, t._sum.subtotalCents ?? 0]),
  )

  // Per-item count for host-cut math — count quantities sold (non-cancelled)
  const itemRows = await prisma.$queryRaw<
    Array<{ campaignId: string; qty: bigint }>
  >`
    SELECT o."campaignId" as "campaignId", COALESCE(SUM(oi.quantity), 0)::bigint as qty
    FROM smellymelly.sm_orders o
    JOIN smellymelly.sm_order_items oi ON oi."orderId" = o.id
    WHERE o."campaignId" IS NOT NULL
      AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY o."campaignId"
  `
  const qtyByCampaign = new Map(
    itemRows.map((r) => [r.campaignId, Number(r.qty)]),
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-dark">
            Fundraiser Campaigns
          </h1>
          <p className="mt-2 text-brand-brown/60">
            Host-led mini-storefronts with campaign pricing. Share the{' '}
            <code className="font-mono text-xs bg-brand-warm/30 px-1 py-0.5 rounded">/party/…</code>{' '}
            link with the host; give them the host dashboard link so they can
            watch orders come in.
          </p>
        </div>
        <Link href="/admin/campaigns/new" className="btn-primary">
          + New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-10 card text-center py-16">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="font-display text-xl font-semibold text-brand-dark">
            No campaigns yet
          </h2>
          <p className="mt-2 text-sm text-brand-brown/60">
            A campaign is a one-off fundraiser at a fixed per-item price. Host
            shares the link, customers buy, Mel fulfills, host distributes.
          </p>
          <Link href="/admin/campaigns/new" className="btn-primary mt-6">
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-lg border border-brand-warm/40 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-brand-warm/20 text-left text-xs uppercase tracking-wider text-brand-brown/60">
              <tr>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Host</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pricing</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3 text-right">Raised</th>
                <th className="px-4 py-3 text-right">Host cut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-warm/30">
              {campaigns.map((c) => {
                const qty = qtyByCampaign.get(c.id) ?? 0
                const subtotal = subtotalByCampaign.get(c.id) ?? 0
                const hostCut = qty * (c.customerPriceCents - c.mellyCutCents)
                return (
                  <tr key={c.id} className="hover:bg-brand-warm/10">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="font-medium text-brand-dark hover:text-brand-terra"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-brand-brown/60 font-mono">
                        /party/{c.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-dark">{c.host.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[c.status] ?? ''}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brand-brown/80">
                      {money(c.customerPriceCents)} · Mel {money(c.mellyCutCents)}
                    </td>
                    <td className="px-4 py-3 text-brand-brown/80 tabular-nums">
                      {c._count.orders}{qty > 0 ? ` (${qty} items)` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {money(subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-green-700">
                      {money(hostCut)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
