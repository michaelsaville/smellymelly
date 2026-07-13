'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Deep-copies a product with its variants and images into a new inactive
 * draft. SKUs are dropped (they're globally unique) and stock resets to 0 so
 * the copy can be edited before going live. Returns the new product id.
 */
export async function duplicateProduct(id: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requireAdmin()

  const src = await prisma.sM_Product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { name: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!src) return { ok: false, error: 'Product not found.' }

  const name = `${src.name} (Copy)`
  let slug = slugify(name)
  if (await prisma.sM_Product.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const created = await prisma.sM_Product.create({
    data: {
      name,
      slug,
      description: src.description,
      scent: src.scent,
      ingredients: src.ingredients,
      categoryId: src.categoryId,
      // A copy starts as an unpublished draft so it can't accidentally go live.
      isActive: false,
      isFeatured: false,
      isGiftSet: false,
      variants: {
        create: src.variants.map((v) => ({
          name: v.name,
          // SKU is globally unique — leave the copy's SKUs blank for the admin to set.
          sku: null,
          priceCents: v.priceCents,
          costCents: v.costCents,
          weightOz: v.weightOz,
          stockQuantity: 0,
          lowStockAt: v.lowStockAt,
          isActive: v.isActive,
        })),
      },
      images: {
        create: src.images.map((img) => ({
          url: img.url,
          altText: img.altText,
          sortOrder: img.sortOrder,
        })),
      },
    },
  })

  revalidatePath('/admin/products')
  return { ok: true, id: created.id }
}
