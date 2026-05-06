import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    name?: string
    displayLabel?: string
    priceLabel?: string
    theme?: string
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const last = await prisma.sM_MenuGroup.findFirst({
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  const group = await prisma.sM_MenuGroup.create({
    data: {
      name: body.name.trim(),
      displayLabel: body.displayLabel?.trim() || null,
      priceLabel: body.priceLabel?.trim() || null,
      theme: body.theme?.trim() || 'scrub',
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  })

  return NextResponse.json({ data: { ...group, scents: [] } }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as {
    id: string
    name?: string
    displayLabel?: string | null
    priceLabel?: string | null
    theme?: string
    sortOrder?: number
    isActive?: boolean
  }

  if (!body.id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name.trim()
  if (body.displayLabel !== undefined) {
    data.displayLabel = body.displayLabel?.trim() || null
  }
  if (body.priceLabel !== undefined) {
    data.priceLabel = body.priceLabel?.trim() || null
  }
  if (body.theme !== undefined) data.theme = body.theme.trim() || 'scrub'
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder
  if (body.isActive !== undefined) data.isActive = body.isActive

  const group = await prisma.sM_MenuGroup.update({
    where: { id: body.id },
    data,
  })

  return NextResponse.json({ data: group })
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = (await req.json()) as { id: string }
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 })
  }

  // Cascade on the link table is set in schema, so this drops the group + its links.
  await prisma.sM_MenuGroup.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
