import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'

// DELETE — remove a single SM_ScentAlias by id.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    await prisma.sM_ScentAlias.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'alias not found' }, { status: 404 })
    }
    throw e
  }
}
