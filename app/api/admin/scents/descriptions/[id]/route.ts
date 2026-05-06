import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { generateScentDescription } from '@/app/lib/scent-descriptions'

// PATCH — save (or clear) a single scent's description. Body: { description }.
// Empty string clears.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { description?: string }
  if (typeof body.description !== 'string') {
    return NextResponse.json(
      { error: 'description (string) required (empty string clears)' },
      { status: 400 },
    )
  }
  const cleaned = body.description.trim()
  const next = cleaned.length === 0 ? null : cleaned
  const scent = await prisma.sM_Scent.update({
    where: { id },
    data: { description: next },
    select: { id: true, name: true, description: true, updatedAt: true },
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
