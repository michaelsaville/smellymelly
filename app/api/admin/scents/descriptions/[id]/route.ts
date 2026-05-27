import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { generateScentDescription } from '@/app/lib/scent-descriptions'

// PATCH — update a single scent's description and/or its "print on the
// descriptions sheet" flag. Body: { description?, onDescriptionSheet? }.
// Empty description string clears it. At least one field required.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as {
    description?: string
    onDescriptionSheet?: boolean
  }

  const data: { description?: string | null; onDescriptionSheet?: boolean } = {}
  if (typeof body.description === 'string') {
    const cleaned = body.description.trim()
    data.description = cleaned.length === 0 ? null : cleaned
  }
  if (typeof body.onDescriptionSheet === 'boolean') {
    data.onDescriptionSheet = body.onDescriptionSheet
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'description (string) or onDescriptionSheet (boolean) required' },
      { status: 400 },
    )
  }

  const scent = await prisma.sM_Scent.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      onDescriptionSheet: true,
      updatedAt: true,
    },
  })
  return NextResponse.json({ scent })
}

// POST — regenerate ONE scent's description. Overwrites any existing text.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const existing = await prisma.sM_Scent.findUnique({
    where: { id },
    select: { id: true, name: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'scent not found' }, { status: 404 })
  }
  try {
    const description = await generateScentDescription(existing.name)
    const updated = await prisma.sM_Scent.update({
      where: { id },
      data: { description },
      select: { id: true, name: true, description: true, updatedAt: true },
    })
    return NextResponse.json({ scent: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
