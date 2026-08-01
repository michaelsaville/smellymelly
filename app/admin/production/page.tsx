import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function ProductionPage() {
  await requireAdmin()

  const [openItems, lowMaterialsRaw] = await Promise.all([
    // Line items on orders that still need making (paid, not yet shipped/picked).
    // GIFT_CARD lines are excluded — a certificate isn't something Mel makes.
    prisma.sM_OrderItem.findMany({
      where: { order: { status: { in: ['PAID', 'PROCESSING'] } }, kind: 'PRODUCT' },
      select: { variantId: true, quantity: true, productName: true, variantName: true },
    }),
    prisma.sM_Material.findMany({
      where: { isActive: true, reorderPoint: { not: null } },
      orderBy: [{ supplier: 'asc' }, { name: 'asc' }],
    }),
  ])

  // Aggregate demand per variant.
  const demand = new Map<string, { name: string; qty: number }>()
  for (const it of openItems) {
    if (!it.variantId) continue // belt-and-braces; the kind filter already excludes these
    const cur = demand.get(it.variantId) ?? {
      name: `${it.productName} · ${it.variantName}`,
      qty: 0,
    }
    cur.qty += it.quantity
    demand.set(it.variantId, cur)
  }

  const variants = demand.size
    ? await prisma.sM_ProductVariant.findMany({
        where: { id: { in: Array.from(demand.keys()) } },
        select: { id: true, stockQuantity: true },
      })
    : []
  const stock = new Map(variants.map((v) => [v.id, v.stockQuantity]))

  const makeList = Array.from(demand.entries())
    .map(([id, d]) => {
      const have = stock.get(id) ?? 0
      return { id, name: d.name, needed: d.qty, have, short: Math.max(0, d.qty - have) }
    })
    .filter((r) => r.short > 0)
    .sort((a, b) => b.short - a.short)

  // Materials at/below reorder point, grouped by supplier.
  const lowMaterials = lowMaterialsRaw.filter(
    (m) => m.reorderPoint != null && m.onHand <= m.reorderPoint,
  )
  const bySupplier = new Map<string, typeof lowMaterials>()
  for (const m of lowMaterials) {
    const key = m.supplier?.trim() || 'Other'
    const arr = bySupplier.get(key) ?? []
    arr.push(m)
    bySupplier.set(key, arr)
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">Production</h1>
      <p className="text-sm text-brand-brown/60 mb-6">
        What to make for open orders, and which raw materials to restock.
      </p>

      {/* To make */}
      <section className="mb-8">
        <h2 className="font-display text-xl font-semibold text-brand-dark mb-3">📦 To make</h2>
        {makeList.length === 0 ? (
          <div className="card text-brand-brown/60">
            You&apos;re caught up — every open order has enough stock. 🎉
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-warm/60">
            <table className="w-full text-sm">
              <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
                <tr>
                  <th className="px-4 py-3">Product · Variant</th>
                  <th className="px-4 py-3 text-right">Ordered</th>
                  <th className="px-4 py-3 text-right">In stock</th>
                  <th className="px-4 py-3 text-right">Make</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-warm/40 bg-white">
                {makeList.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-muted">
                    <td className="px-4 py-3 text-brand-dark">{r.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-brand-brown/70">{r.needed}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-brand-brown/70">{r.have}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-brand-terra">{r.short}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-brand-brown/50">
          Make a batch from <Link href="/admin/recipes" className="text-brand-terra hover:underline">Recipes</Link> to
          add finished stock and deduct materials.
        </p>
      </section>

      {/* Restock materials */}
      <section>
        <h2 className="font-display text-xl font-semibold text-brand-dark mb-3">🛒 Restock materials</h2>
        {lowMaterials.length === 0 ? (
          <div className="card text-brand-brown/60">
            No materials are below their reorder point. Set reorder points in{' '}
            <Link href="/admin/materials" className="text-brand-terra hover:underline">Materials</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(bySupplier.entries()).map(([supplier, mats]) => (
              <div key={supplier} className="card">
                <h3 className="font-medium text-brand-dark mb-2">{supplier}</h3>
                <ul className="space-y-1 text-sm">
                  {mats.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span className="text-brand-brown">{m.name}</span>
                      <span className="text-brand-brown/60 tabular-nums">
                        {m.onHand} / reorder at {m.reorderPoint} {m.packageUnit}
                        <span className="ml-2 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
                          buy {Math.max(0, (m.reorderPoint ?? 0) - m.onHand).toFixed(1)}+
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
