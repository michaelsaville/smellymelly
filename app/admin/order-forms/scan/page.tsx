import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import ScanClient, { type VariantOption } from './ScanClient'

export const dynamic = 'force-dynamic'

export default async function ScanFormPage() {
  await requireAdmin()

  const products = await prisma.sM_Product.findMany({
    where: { isActive: true, variants: { some: { isActive: true } } },
    include: {
      variants: { where: { isActive: true }, orderBy: { priceCents: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const variantOptions: VariantOption[] = []
  for (const p of products) {
    for (const v of p.variants) {
      variantOptions.push({
        variantId: v.id,
        productName: p.name,
        variantName: v.name,
        priceCents: v.priceCents,
        stock: v.stockQuantity,
      })
    }
  }

  return <ScanClient variantOptions={variantOptions} />
}
