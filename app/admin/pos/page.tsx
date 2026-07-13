import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import PosClient from './PosClient'

export const dynamic = 'force-dynamic'

export default async function PosPage() {
  await requireAdmin()

  const [variants, settings] = await Promise.all([
    prisma.sM_ProductVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      include: { product: { select: { name: true, scent: true } } },
      orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: { taxRate: true },
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
        variants={variants.map((v) => ({
          id: v.id,
          label: v.product.name,
          sublabel: v.name,
          scent: v.product.scent,
          priceCents: v.priceCents,
          stock: v.stockQuantity,
        }))}
      />
    </div>
  )
}
