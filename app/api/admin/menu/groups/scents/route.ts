import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

// PUT — replace the full ordered list of scents for one group.
// Body: { groupId: string, scentIds: string[] }
// One transaction: drop existing links, recreate in given order.
export async function PUT(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as { groupId: string; scentIds: string[] }
  if (!body.groupId || !Array.isArray(body.scentIds)) {
    return NextResponse.json(
      { error: 'groupId + scentIds[] required' },
      { status: 400 },
    )
  }

  const uniqueIds = Array.from(new Set(body.scentIds))

  await prisma.$transaction([
    prisma.sM_MenuGroupScent.deleteMany({ where: { groupId: body.groupId } }),
    ...(uniqueIds.length > 0
      ? [
          prisma.sM_MenuGroupScent.createMany({
            data: uniqueIds.map((scentId, i) => ({
              groupId: body.groupId,
              scentId,
              sortOrder: i,
            })),
          }),
        ]
      : []),
  ])

  return NextResponse.json({ success: true, count: uniqueIds.length })
}
