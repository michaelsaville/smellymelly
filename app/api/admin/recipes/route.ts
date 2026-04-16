import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const recipes = await prisma.sM_Recipe.findMany({
    include: {
      product: { select: { id: true, name: true } },
      items: { include: { material: true } },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: recipes })
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Recipe name is required' }, { status: 400 })
  }

  try {
    const recipe = await prisma.sM_Recipe.create({
      data: {
        name: body.name.trim(),
        productId: body.productId || null,
        yields: parseInt(body.yields || '1', 10),
        notes: body.notes?.trim() || null,
        items: body.items?.length
          ? {
              create: body.items.map((item: any) => ({
                materialId: item.materialId,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
              })),
            }
          : undefined,
      },
      include: {
        product: { select: { id: true, name: true } },
        items: { include: { material: true } },
      },
    })

    return NextResponse.json({ data: recipe })
  } catch (e) {
    console.error('[admin/recipes] create failed:', e)
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 })
  }
}
