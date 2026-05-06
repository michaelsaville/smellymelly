import { NextResponse } from 'next/server'
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

  const samples = await prisma.sM_AIMessageSample.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data: samples })
}

// DELETE without body → wipe everything.
// DELETE with { id } → remove one sample.
export async function DELETE(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let id: string | undefined
  try {
    const body = await req.json()
    id = typeof body?.id === 'string' ? body.id : undefined
  } catch {
    // No body — wipe-all path.
  }

  if (id) {
    await prisma.sM_AIMessageSample.delete({ where: { id } }).catch(() => {})
    return NextResponse.json({ success: true, mode: 'one' })
  }

  const result = await prisma.sM_AIMessageSample.deleteMany({})
  return NextResponse.json({ success: true, mode: 'all', removed: result.count })
}
