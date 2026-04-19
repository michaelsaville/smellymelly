import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface PostBody {
  tagId?: string
  action?: 'add' | 'remove'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: customerId } = await params
  const body = (await req.json()) as PostBody

  if (!body.tagId) {
    return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
  }
  if (body.action !== 'add' && body.action !== 'remove') {
    return NextResponse.json(
      { error: "action must be 'add' or 'remove'" },
      { status: 400 },
    )
  }

  if (body.action === 'add') {
    await prisma.sM_CustomerTag.upsert({
      where: { customerId_tagId: { customerId, tagId: body.tagId } },
      create: { customerId, tagId: body.tagId },
      update: {},
    })
  } else {
    await prisma.sM_CustomerTag.deleteMany({
      where: { customerId, tagId: body.tagId },
    })
  }

  return NextResponse.json({ ok: true })
}
