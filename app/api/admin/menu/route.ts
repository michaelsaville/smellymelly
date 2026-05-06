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

  const [groups, allScents] = await Promise.all([
    prisma.sM_MenuGroup.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        scentLinks: {
          orderBy: { sortOrder: 'asc' },
          include: { scent: true },
        },
      },
    }),
    prisma.sM_Scent.findMany({ orderBy: { name: 'asc' } }),
  ])

  return NextResponse.json({
    data: {
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        displayLabel: g.displayLabel,
        priceLabel: g.priceLabel,
        theme: g.theme,
        sortOrder: g.sortOrder,
        isActive: g.isActive,
        scents: g.scentLinks.map((l) => ({
          id: l.scent.id,
          name: l.scent.name,
        })),
      })),
      allScents: allScents.map((s) => ({
        id: s.id,
        name: s.name,
        isActive: s.isActive,
      })),
    },
  })
}
