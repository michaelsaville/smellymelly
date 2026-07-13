import type { Prisma, SM_OrderStatus } from '@prisma/client'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { parseFilters, resolveDateRange, describeRange, REVENUE_STATUSES } from '@/app/lib/order-views'
import ReportRangePicker from './ReportRangePicker'

export const dynamic = 'force-dynamic'

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}
function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()

  const sp = await searchParams
  const get = (k: string): string | null => {
    const v = sp[k]
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
  }
  // Default to "this month" when no range is chosen.
  const filters = parseFilters(get)
  if (!filters.range) filters.range = 'month'

  const dr = resolveDateRange(filters)
  const where: Prisma.SM_OrderWhereInput = {
    status: { in: REVENUE_STATUSES as SM_OrderStatus[] },
    ...(dr.gte || dr.lte
      ? { createdAt: { ...(dr.gte ? { gte: dr.gte } : {}), ...(dr.lte ? { lte: dr.lte } : {}) } }
      : {}),
  }

  const orders = await prisma.sM_Order.findMany({
    where,
    select: {
      taxCents: true,
      shippingCents: true,
      totalCents: true,
      items: {
        select: {
          productName: true,
          quantity: true,
          totalCents: true,
          variant: { select: { costCents: true } },
        },
      },
    },
  })

  // Roll up totals + a per-product breakdown.
  type Agg = { units: number; revenueCents: number; cogsCents: number; missingCost: boolean }
  const byProduct = new Map<string, Agg>()
  let taxCents = 0
  let shippingCents = 0
  let grossCents = 0
  let revenueCents = 0
  let cogsCents = 0
  let anyMissingCost = false

  for (const o of orders) {
    taxCents += o.taxCents
    shippingCents += o.shippingCents
    grossCents += o.totalCents
    for (const it of o.items) {
      const cost = (it.variant?.costCents ?? 0) * it.quantity
      const missing = !it.variant?.costCents
      if (missing) anyMissingCost = true
      revenueCents += it.totalCents
      cogsCents += cost
      const cur = byProduct.get(it.productName) ?? { units: 0, revenueCents: 0, cogsCents: 0, missingCost: false }
      cur.units += it.quantity
      cur.revenueCents += it.totalCents
      cur.cogsCents += cost
      cur.missingCost = cur.missingCost || missing
      byProduct.set(it.productName, cur)
    }
  }

  const profitCents = revenueCents - cogsCents
  const margin = revenueCents > 0 ? profitCents / revenueCents : 0
  const products = Array.from(byProduct.entries())
    .map(([name, a]) => ({ name, ...a, profitCents: a.revenueCents - a.cogsCents }))
    .sort((a, b) => b.profitCents - a.profitCents)

  const tiles = [
    { label: 'Orders', value: String(orders.length) },
    { label: 'Product sales', value: money(revenueCents) },
    { label: 'Sales tax', value: money(taxCents), accent: true },
    { label: 'Cost of goods', value: money(cogsCents) },
    { label: 'Profit', value: money(profitCents), accent: true },
    { label: 'Margin', value: pct(margin) },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="font-display text-3xl font-bold text-brand-dark">Reports</h1>
        <ReportRangePicker range={filters.range} from={filters.from} to={filters.to} />
      </div>

      <div className="card mb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-brand-brown/60 mb-3">
          {describeRange(filters)} · paid orders
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg bg-surface-muted/60 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wide text-brand-brown/60">{t.label}</div>
              <div className={`font-display text-2xl tabular-nums ${t.accent ? 'text-brand-terra' : 'text-brand-dark'}`}>
                {t.value}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-brand-brown/50">
          <strong>{money(taxCents)}</strong> is the sales tax you collected this period (for filing).
          Gross incl. tax + shipping: {money(grossCents)} · shipping collected: {money(shippingCents)}.
          {anyMissingCost && ' ⚠ Some items have no cost set, so COGS/profit are understated — set variant costs or link recipes.'}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="card text-center py-12 text-brand-brown/60">No paid orders in this period.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-warm/60">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">COGS</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-warm/40 bg-white">
              {products.map((p) => (
                <tr key={p.name} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-medium text-brand-dark">
                    {p.name}
                    {p.missingCost && <span title="Some variants have no cost set" className="ml-1 text-amber-500">⚠</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.units}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(p.revenueCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-brown/70">{money(p.cogsCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-dark">{money(p.profitCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-brown/70">
                    {p.revenueCents > 0 ? pct(p.profitCents / p.revenueCents) : '—'}
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
