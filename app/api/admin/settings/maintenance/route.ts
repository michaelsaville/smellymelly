import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface Body {
  maintenanceMode?: boolean
  maintenanceMessage?: string
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as Body
  const data: { maintenanceMode?: boolean; maintenanceMessage?: string } = {}
  if (typeof body.maintenanceMode === 'boolean') {
    data.maintenanceMode = body.maintenanceMode
  }
  if (typeof body.maintenanceMessage === 'string') {
    data.maintenanceMessage = body.maintenanceMessage
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await prisma.sM_Settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  })

  const current = await prisma.sM_Settings.findUnique({
    where: { id: 'singleton' },
    select: { maintenanceMode: true, maintenanceMessage: true },
  })
  return NextResponse.json({ ok: true, ...current })
}
