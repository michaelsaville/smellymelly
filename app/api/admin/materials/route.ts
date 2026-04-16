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

  const materials = await prisma.sM_Material.findMany({
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: materials })
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.name?.trim() || !body.packageSize || !body.packageUnit) {
    return NextResponse.json({ error: 'Name, package size, and unit are required' }, { status: 400 })
  }

  try {
    const material = await prisma.sM_Material.create({
      data: {
        name: body.name.trim(),
        packageCostCents: Math.round(parseFloat(body.packageCostCents || '0') * 100),
        packageSize: parseFloat(body.packageSize),
        packageUnit: body.packageUnit,
        supplier: body.supplier?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    })

    return NextResponse.json({ data: material })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'A material with that name already exists' }, { status: 409 })
    }
    console.error('[admin/materials] create failed:', e)
    return NextResponse.json({ error: 'Failed to create material' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.id) {
    return NextResponse.json({ error: 'Missing material ID' }, { status: 400 })
  }

  try {
    const material = await prisma.sM_Material.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim(),
        packageCostCents: body.packageCostCents != null
          ? Math.round(parseFloat(body.packageCostCents) * 100)
          : undefined,
        packageSize: body.packageSize != null ? parseFloat(body.packageSize) : undefined,
        packageUnit: body.packageUnit || undefined,
        supplier: body.supplier !== undefined ? (body.supplier?.trim() || null) : undefined,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : undefined,
        isActive: body.isActive,
      },
    })

    return NextResponse.json({ data: material })
  } catch (e) {
    console.error('[admin/materials] update failed:', e)
    return NextResponse.json({ error: 'Failed to update material' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  if (!body.id) {
    return NextResponse.json({ error: 'Missing material ID' }, { status: 400 })
  }

  // Check if used in any recipes
  const usedCount = await prisma.sM_RecipeItem.count({
    where: { materialId: body.id },
  })

  if (usedCount > 0) {
    // Soft-delete: deactivate
    await prisma.sM_Material.update({
      where: { id: body.id },
      data: { isActive: false },
    })
    return NextResponse.json({ data: { deactivated: true } })
  }

  await prisma.sM_Material.delete({ where: { id: body.id } })
  return NextResponse.json({ data: { deleted: true } })
}
