import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    name: string
    scent?: string | null
    categoryId: string
    description?: string | null
    isFeatured?: boolean
    variants?: Array<{
      name: string
      priceCents: number
      costCents?: number | null
      weightOz?: number | null
      stockQuantity?: number
      sku?: string | null
    }>
  }

  if (!body.name?.trim() || !body.categoryId) {
    return NextResponse.json(
      { error: 'Name and category are required' },
      { status: 400 },
    )
  }

  // Generate unique slug
  let slug = slugify(body.name)
  const existing = await prisma.sM_Product.findUnique({ where: { slug } })
  if (existing) slug = `${slug}-${Date.now().toString(36)}`

  try {
    const product = await prisma.sM_Product.create({
      data: {
        name: body.name.trim(),
        slug,
        scent: body.scent || null,
        categoryId: body.categoryId,
        description: body.description || null,
        isFeatured: body.isFeatured ?? false,
        variants: {
          create: (body.variants ?? []).map((v) => ({
            name: v.name,
            priceCents: v.priceCents,
            costCents: v.costCents ?? null,
            weightOz: v.weightOz ?? null,
            stockQuantity: v.stockQuantity ?? 0,
            sku: v.sku || null,
          })),
        },
      },
      include: { variants: true },
    })

    return NextResponse.json({ data: product }, { status: 201 })
  } catch (e) {
    console.error('[admin/products] create failed', e)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
