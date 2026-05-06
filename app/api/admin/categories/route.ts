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

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || 'category'
  let slug = root
  let n = 2
  while (true) {
    const hit = await prisma.sM_Category.findUnique({ where: { slug } })
    if (!hit || hit.id === excludeId) return slug
    slug = `${root}-${n++}`
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    name?: string
    slug?: string
    baseIngredients?: string
    iconEmoji?: string | null
    iconImageUrl?: string | null
  }

  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const dupName = await prisma.sM_Category.findUnique({ where: { name } })
  if (dupName) {
    return NextResponse.json(
      { error: 'A category with that name already exists' },
      { status: 409 },
    )
  }

  const slug = await uniqueSlug(slugify(body.slug?.trim() || name))

  const last = await prisma.sM_Category.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const cat = await prisma.sM_Category.create({
    data: {
      name,
      slug,
      baseIngredients: body.baseIngredients?.trim() || null,
      iconEmoji: body.iconEmoji?.trim() || null,
      iconImageUrl: body.iconImageUrl?.trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })

  return NextResponse.json(
    { data: { ...cat, productCount: 0 } },
    { status: 201 },
  )
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    id: string
    name?: string
    slug?: string
    baseIngredients?: string | null
    iconEmoji?: string | null
    iconImageUrl?: string | null
    iconSheetEmoji?: string | null
    iconSheetImageUrl?: string | null
    isActive?: boolean
    sortOrder?: number
  }

  if (!body.id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }
    const dup = await prisma.sM_Category.findUnique({ where: { name } })
    if (dup && dup.id !== body.id) {
      return NextResponse.json(
        { error: 'A category with that name already exists' },
        { status: 409 },
      )
    }
    data.name = name
  }

  if (body.slug !== undefined) {
    const slug = await uniqueSlug(slugify(body.slug), body.id)
    data.slug = slug
  }

  if (body.baseIngredients !== undefined) {
    data.baseIngredients = body.baseIngredients?.trim() || null
  }

  if (body.iconEmoji !== undefined) {
    data.iconEmoji = body.iconEmoji?.trim() || null
  }
  if (body.iconImageUrl !== undefined) {
    data.iconImageUrl = body.iconImageUrl?.trim() || null
  }
  if (body.iconSheetEmoji !== undefined) {
    data.iconSheetEmoji = body.iconSheetEmoji?.trim() || null
  }
  if (body.iconSheetImageUrl !== undefined) {
    data.iconSheetImageUrl = body.iconSheetImageUrl?.trim() || null
  }

  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

  const cat = await prisma.sM_Category.update({
    where: { id: body.id },
    data,
  })

  return NextResponse.json({ data: cat })
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, reassignToId } = (await req.json()) as {
    id: string
    reassignToId?: string
  }
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  const productCount = await prisma.sM_Product.count({
    where: { categoryId: id },
  })

  if (productCount === 0) {
    await prisma.sM_Category.delete({ where: { id } })
    return NextResponse.json({ success: true, moved: 0 })
  }

  // Products attached — caller must specify where to move them.
  if (!reassignToId) {
    return NextResponse.json(
      {
        error: `${productCount} product${productCount === 1 ? '' : 's'} still in this category. Pick a category to move them into, then delete.`,
        productCount,
      },
      { status: 409 },
    )
  }

  if (reassignToId === id) {
    return NextResponse.json(
      { error: "Can't move products into the category you're deleting." },
      { status: 400 },
    )
  }

  const target = await prisma.sM_Category.findUnique({
    where: { id: reassignToId },
    select: { id: true },
  })
  if (!target) {
    return NextResponse.json(
      { error: 'Target category not found' },
      { status: 404 },
    )
  }

  await prisma.$transaction([
    prisma.sM_Product.updateMany({
      where: { categoryId: id },
      data: { categoryId: reassignToId },
    }),
    prisma.sM_Category.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true, moved: productCount })
}

// PUT — bulk reorder. Body: { ids: string[] } in display order.
export async function PUT(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { ids?: string[] }
  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'ids[] required' }, { status: 400 })
  }

  await prisma.$transaction(
    body.ids.map((id, i) =>
      prisma.sM_Category.update({
        where: { id },
        data: { sortOrder: i },
      }),
    ),
  )

  return NextResponse.json({ success: true, count: body.ids.length })
}
