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

  const scents = await prisma.sM_Scent.findMany({
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ data: scents })
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { name: string }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Get max sort order
  const last = await prisma.sM_Scent.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  try {
    const scent = await prisma.sM_Scent.create({
      data: {
        name: body.name.trim(),
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json({ data: scent }, { status: 201 })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Scent already exists' }, { status: 409 })
    }
    console.error('[admin/scents] create failed', e)
    return NextResponse.json({ error: 'Failed to create scent' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = (await req.json()) as { id: string }

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  await prisma.sM_Scent.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { id: string; name?: string; isActive?: boolean; sortOrder?: number }

  if (!body.id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  const data: Record<string, any> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.isActive !== undefined) data.isActive = body.isActive
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

  try {
    const scent = await prisma.sM_Scent.update({ where: { id: body.id }, data })
    return NextResponse.json({ data: scent })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'Scent name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to update scent' }, { status: 500 })
  }
}
