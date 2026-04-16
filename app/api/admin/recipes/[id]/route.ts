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

  const recipe = await prisma.sM_Recipe.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true } },
      items: { include: { material: true } },
    },
  })

  if (!recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })
  }

  return NextResponse.json({ data: recipe })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  try {
    // Update recipe fields
    await prisma.sM_Recipe.update({
      where: { id },
      data: {
        name: body.name?.trim(),
        productId: body.productId !== undefined ? (body.productId || null) : undefined,
        yields: body.yields != null ? parseInt(body.yields, 10) : undefined,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : undefined,
      },
    })

    // Replace all recipe items if provided
    if (body.items) {
      await prisma.sM_RecipeItem.deleteMany({ where: { recipeId: id } })

      if (body.items.length > 0) {
        await prisma.sM_RecipeItem.createMany({
          data: body.items.map((item: any) => ({
            recipeId: id,
            materialId: item.materialId,
            quantity: parseFloat(item.quantity),
            unit: item.unit,
          })),
        })
      }
    }

    const updated = await prisma.sM_Recipe.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true } },
        items: { include: { material: true } },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (e) {
    console.error('[admin/recipes] update failed:', e)
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 })
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

  await prisma.sM_Recipe.delete({ where: { id } })

  return NextResponse.json({ data: { deleted: true } })
}
