import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import PosClient from './PosClient'

export const dynamic = 'force-dynamic'

// Variant names encode "Scent - Size" (e.g. "Blueberry - 2oz"), or a bare scent
// when there's a single size, or a bare size. Split them so the POS can group
// product → size → scent. Mirrors app/shop/[slug]/AddToCart.tsx.
const SIZE_RE = /^(\d+(?:\.\d+)?)\s*(oz|ml|g|lb)$/i

function parseVariant(name: string): { scent: string; size: string } {
  const idx = name.lastIndexOf(' - ')
  if (idx >= 0) {
    const tail = name.slice(idx + 3).trim()
    if (SIZE_RE.test(tail)) {
      return { scent: name.slice(0, idx).trim(), size: tail.toLowerCase() }
    }
  }
  // No "scent - size": a bare size is size-only, anything else is scent-only.
  const trimmed = name.trim()
  if (SIZE_RE.test(trimmed)) return { scent: '', size: trimmed.toLowerCase() }
  return { scent: trimmed, size: '' }
}

export default async function PosPage() {
  await requireAdmin()

  const [variants, settings] = await Promise.all([
    prisma.sM_ProductVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      include: {
        product: { select: { id: true, name: true, category: { select: { name: true } } } },
      },
      orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: { taxRate: true, posHideOutOfStock: true, terminalReaderLabel: true },
    }),
  ])

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-1">New Sale</h1>
      <p className="text-sm text-brand-brown/60 mb-6">
        Ring up an in-person or market sale. Stock is deducted and the order is recorded as paid.
      </p>

      <PosClient
        taxRate={settings?.taxRate ?? 0.06}
        hideOutOfStock={settings?.posHideOutOfStock ?? false}
        readerLabel={settings?.terminalReaderLabel ?? null}
        variants={variants.map((v) => {
          const { scent, size } = parseVariant(v.name)
          return {
            id: v.id,
            productId: v.product.id,
            product: v.product.name,
            category: v.product.category?.name ?? null,
            scent,
            size,
            priceCents: v.priceCents,
            stock: v.stockQuantity,
          }
        })}
      />
    </div>
  )
}
