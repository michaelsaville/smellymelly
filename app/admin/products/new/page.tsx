import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import Link from 'next/link'
import { ProductForm } from './ProductForm'

export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
  await requireAdmin()

  let categories = await prisma.sM_Category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  const scents = await prisma.sM_Scent.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  // Seed default categories if none exist. Slug `candles` is a legacy
  // identifier for the Home Fragrance category (kept for URL continuity).
  if (categories.length === 0) {
    const defaults = [
      { name: 'Home Fragrance', slug: 'candles', sortOrder: 1 },
      { name: 'Bath & Body', slug: 'bath-body', sortOrder: 3 },
      { name: 'Lip Care', slug: 'lip-care', sortOrder: 4 },
    ]
    for (const cat of defaults) {
      await prisma.sM_Category.create({ data: cat })
    }
    categories = await prisma.sM_Category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    })
  }

  return (
    <div>
      <Link
        href="/admin/products"
        className="text-sm text-brand-brown/60 hover:text-brand-terra"
      >
        ← Back to Products
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-brand-dark">
        New Product
      </h1>

      <ProductForm categories={categories} scents={scents} />
    </div>
  )
}
