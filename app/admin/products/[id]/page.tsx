import { redirect } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import EditProductForm from './EditProductForm'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({
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
      variants: { orderBy: { name: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!product) redirect('/admin/products')

  const categories = await prisma.sM_Category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          Edit: {product.name}
        </h1>
        <a href="/admin/products" className="btn-ghost text-sm">
          &larr; Back to Products
        </a>
      </div>

      <EditProductForm
        product={product}
        categories={categories}
      />
    </div>
  )
}
