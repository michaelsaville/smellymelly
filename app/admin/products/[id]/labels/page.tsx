import { redirect } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import LabelPreview from './LabelPreview'

export const dynamic = 'force-dynamic'

export default async function LabelsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const product = await prisma.sM_Product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: { where: { isActive: true }, orderBy: { name: 'asc' } },
    },
  })

  if (!product) redirect('/admin/products')

  // Build label entries: if the product has a scent field, there's one label.
  // If scent is empty but variants exist, each variant name IS the scent.
  const labels: { scent: string; variantName: string }[] = []

  if (product.scent) {
    // Single-scent product — one label regardless of size variants
    labels.push({ scent: product.scent, variantName: '' })
  } else {
    // Multi-scent product — each variant is a scent
    for (const v of product.variants) {
      labels.push({ scent: v.name, variantName: v.name })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          Labels: {product.name}
        </h1>
        <a
          href={`/admin/products/${product.id}`}
          className="btn-ghost text-sm"
        >
          &larr; Back to Product
        </a>
      </div>

      <LabelPreview
        productName={product.category.name}
        labels={labels}
        ingredients={product.ingredients ?? ''}
      />
    </div>
  )
}
