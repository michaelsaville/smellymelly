import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

/**
 * Replace the SM_ScentCategory rows for a single scent with the given
 * list of categoryIds. Atomic transaction: deletes the rows not in the
 * list, creates the rows that aren't already present.
 *
 * Body: { categoryIds: string[] }
 *
 * Note: this is for the Scent Sheet's category-availability marking,
 * which is INDEPENDENT of menu-group membership (SM_MenuGroupScent).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: scentId } = await params
  const body = (await req.json().catch(() => null)) as
    | { categoryIds?: string[] }
    | null
  const incomingIds = Array.isArray(body?.categoryIds)
    ? body!.categoryIds.filter((c): c is string => typeof c === 'string')
    : null

  if (!incomingIds) {
    return NextResponse.json(
      { error: 'categoryIds (string array) is required' },
      { status: 400 },
    )
  }

  const scent = await prisma.sM_Scent.findUnique({
    where: { id: scentId },
    select: { id: true },
  })
  if (!scent) {
    return NextResponse.json({ error: 'Scent not found' }, { status: 404 })
  }

  const wantedSet = new Set(incomingIds)

  await prisma.$transaction(async (tx) => {
    const existing = await tx.sM_ScentCategory.findMany({
      where: { scentId },
      select: { id: true, categoryId: true },
    })
    const existingMap = new Map(existing.map((r) => [r.categoryId, r.id]))

    const toDelete = existing
      .filter((r) => !wantedSet.has(r.categoryId))
      .map((r) => r.id)
    const toCreate = incomingIds.filter((c) => !existingMap.has(c))

    if (toDelete.length > 0) {
      await tx.sM_ScentCategory.deleteMany({
        where: { id: { in: toDelete } },
      })
    }
    if (toCreate.length > 0) {
      await tx.sM_ScentCategory.createMany({
        data: toCreate.map((categoryId) => ({ scentId, categoryId })),
        skipDuplicates: true,
      })
    }
  })

  return NextResponse.json({ ok: true })
}
