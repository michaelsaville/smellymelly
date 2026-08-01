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

  // Paid custom/wholesale invoices are a real revenue channel — range them on
  // when they were PAID (revenue realized), not when drafted.
  const invoices = await prisma.sM_Invoice.findMany({
    where: {
      status: 'PAID',
      ...(dr.gte || dr.lte
        ? { paidAt: { ...(dr.gte ? { gte: dr.gte } : {}), ...(dr.lte ? { lte: dr.lte } : {}) } }
        : {}),
    },
    select: { subtotalCents: true, taxCents: true, totalCents: true },
  })

  const orders = await prisma.sM_Order.findMany({
    where,
    select: {
      taxCents: true,
      shippingCents: true,
      totalCents: true,
      discountCents: true,
      giftCardCents: true,
      items: {
        select: {
          kind: true,
          productName: true,
          quantity: true,
          totalCents: true,
          variant: { select: { costCents: true } },
        },
      },
    },
  })

  // Roll up totals + a per-product breakdown. Per-product "Sales" stays at the
  // gross line price (a volume metric); order-level promo discounts are netted
  // off the store-wide revenue/profit figures below.
  type Agg = { units: number; revenueCents: number; cogsCents: number; missingCost: boolean }
  const byProduct = new Map<string, Agg>()
  let taxCents = 0
  let shippingCents = 0
  let grossCents = 0
  let grossProductCents = 0
  let discountCents = 0
  let cogsCents = 0
  let anyMissingCost = false
  // Gift certificates SOLD in this period. Deliberately NOT revenue: it's cash
  // for a promise of goods, and it becomes income when the card is redeemed
  // (at which point the redeemed purchase shows up as ordinary product sales).
  // Tracked separately so the cash in the till still reconciles.
  let giftCardSoldCents = 0
  // Gift certificates SPENT in this period. The merchandise is already counted
  // in revenue above; this is only how much of it was paid with a certificate
  // rather than cash, which is again a till-reconciliation number.
  let giftCardRedeemedCents = 0

  for (const o of orders) {
    taxCents += o.taxCents
    shippingCents += o.shippingCents
    grossCents += o.totalCents
    discountCents += o.discountCents
    giftCardRedeemedCents += o.giftCardCents
    for (const it of o.items) {
      if (it.kind === 'GIFT_CARD') {
        giftCardSoldCents += it.totalCents
        continue // never revenue, never COGS, never a product row
      }
      const cost = (it.variant?.costCents ?? 0) * it.quantity
      const missing = !it.variant?.costCents
      if (missing) anyMissingCost = true
      grossProductCents += it.totalCents
      cogsCents += cost
      const cur = byProduct.get(it.productName) ?? { units: 0, revenueCents: 0, cogsCents: 0, missingCost: false }
      cur.units += it.quantity
      cur.revenueCents += it.totalCents
      cur.cogsCents += cost
      cur.missingCost = cur.missingCost || missing
      byProduct.set(it.productName, cur)
    }
  }

  // Fold in paid invoices: their subtotal is revenue, their tax is collected tax.
  const invoiceRevenueCents = invoices.reduce((s, i) => s + i.subtotalCents, 0)
  const invoiceTaxCents = invoices.reduce((s, i) => s + i.taxCents, 0)
  const invoiceGrossCents = invoices.reduce((s, i) => s + i.totalCents, 0)
  taxCents += invoiceTaxCents
  grossCents += invoiceGrossCents

  // Net revenue = gross product sales − promo discounts + paid-invoice sales.
  // Invoices carry no COGS linkage, so they flow straight to profit.
  const revenueCents = grossProductCents - discountCents + invoiceRevenueCents
  const profitCents = revenueCents - cogsCents
  const margin = revenueCents > 0 ? profitCents / revenueCents : 0
  const products = Array.from(byProduct.entries())
    .map(([name, a]) => ({ name, ...a, profitCents: a.revenueCents - a.cogsCents }))
    .sort((a, b) => b.profitCents - a.profitCents)

  const tiles = [
    { label: 'Orders', value: String(orders.length) },
    { label: 'Net sales', value: money(revenueCents) },
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
          {describeRange(filters)} · paid orders{invoices.length > 0 ? ' + invoices' : ''}
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
          Net sales are after promo discounts{discountCents > 0 ? ` (−${money(discountCents)})` : ''}
          {invoices.length > 0 && `, and include ${invoices.length} paid invoice${invoices.length === 1 ? '' : 's'} (${money(invoiceRevenueCents)} custom/wholesale)`}.
          Gross incl. tax + shipping: {money(grossCents)} · shipping collected: {money(shippingCents)}.
          {anyMissingCost && ' ⚠ Some items have no cost set, so COGS/profit are understated — set variant costs or link recipes.'}
          {(giftCardSoldCents > 0 || giftCardRedeemedCents > 0) && (
            <>
              {' '}
              Gift certificates: <strong>{money(giftCardSoldCents)}</strong> sold (cash in, but not
              income until it&apos;s spent, so it&apos;s excluded from net sales) ·{' '}
              <strong>{money(giftCardRedeemedCents)}</strong> redeemed (goods already counted in
              net sales, just paid for with a certificate instead of cash).
            </>
          )}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="card text-center py-12 text-brand-brown/60">
          No product sales in this period.{invoices.length > 0 && ' (Invoice revenue is included in the totals above.)'}
        </div>
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
