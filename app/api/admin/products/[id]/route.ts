import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const product = await prisma.sM_Product.findUnique({
    where: { id },
    include: {
      category: true,
      variants: { orderBy: { name: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ data: product })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await req.json()) as {
    name?: string
    categoryId?: string
    description?: string | null
    ingredients?: string | null
    isFeatured?: boolean
    isActive?: boolean
    variants?: Array<{
      id?: string // existing variant ID (omit for new)
      name: string
      priceCents: number
      costCents?: number | null
      weightOz?: number | null
      stockQuantity?: number
      sku?: string | null
      isActive?: boolean
    }>
  }

  const existing = await prisma.sM_Product.findUnique({
    where: { id },
    include: { variants: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  try {
    // Update product fields
    const product = await prisma.sM_Product.update({
      where: { id },
      data: {
        name: body.name?.trim() || existing.name,
        categoryId: body.categoryId || existing.categoryId,
        description: body.description !== undefined ? (body.description || null) : existing.description,
        ingredients: body.ingredients !== undefined ? (body.ingredients || null) : existing.ingredients,
        isFeatured: body.isFeatured ?? existing.isFeatured,
        isActive: body.isActive ?? existing.isActive,
      },
    })

    // Handle variant updates if provided
    if (body.variants) {
      const incomingIds = new Set(body.variants.filter((v) => v.id).map((v) => v.id!))
      const existingIds = new Set(existing.variants.map((v) => v.id))

      // Delete variants that are no longer in the list
      const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid))
      if (toDelete.length > 0) {
        await prisma.sM_ProductVariant.deleteMany({
          where: { id: { in: toDelete }, productId: id },
        })
      }

      // Update existing + create new
      for (const v of body.variants) {
        if (v.id && existingIds.has(v.id)) {
          await prisma.sM_ProductVariant.update({
            where: { id: v.id },
            data: {
              name: v.name,
              priceCents: v.priceCents,
              costCents: v.costCents ?? null,
              weightOz: v.weightOz ?? null,
              stockQuantity: v.stockQuantity ?? 0,
              sku: v.sku || null,
              isActive: v.isActive ?? true,
            },
          })
        } else if (!v.id) {
          await prisma.sM_ProductVariant.create({
            data: {
              productId: id,
              name: v.name,
              priceCents: v.priceCents,
              costCents: v.costCents ?? null,
              weightOz: v.weightOz ?? null,
              stockQuantity: v.stockQuantity ?? 0,
              sku: v.sku || null,
            },
          })
        }
      }
    }

    const updated = await prisma.sM_Product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: { orderBy: { name: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (e) {
    console.error('[admin/products] update failed:', e)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const product = await prisma.sM_Product.findUnique({
    where: { id },
    include: { variants: { include: { orderItems: { take: 1 } } } },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  // Check if any variants have order history
  const hasOrders = product.variants.some((v) => v.orderItems.length > 0)

  if (hasOrders) {
    // Soft-delete: deactivate instead of deleting
    await prisma.sM_Product.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ data: { deactivated: true } })
  }

  // Hard delete: no order history, safe to remove
  await prisma.sM_ProductImage.deleteMany({ where: { productId: id } })
  await prisma.sM_ProductVariant.deleteMany({ where: { productId: id } })
  await prisma.sM_Product.delete({ where: { id } })

  return NextResponse.json({ data: { deleted: true } })
}
