import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface Body {
  venmoHandle?: string
  cashAppTag?: string
  paymentInstructions?: string
  taxRate?: number
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as Body
  const data: {
    venmoHandle?: string
    cashAppTag?: string
    paymentInstructions?: string
    taxRate?: number
  } = {}

  if (typeof body.venmoHandle === 'string') data.venmoHandle = body.venmoHandle
  if (typeof body.cashAppTag === 'string') data.cashAppTag = body.cashAppTag
  if (typeof body.paymentInstructions === 'string') {
    data.paymentInstructions = body.paymentInstructions
  }
  if (typeof body.taxRate === 'number') {
    if (body.taxRate < 0 || body.taxRate > 1) {
      return NextResponse.json(
        { error: 'taxRate must be a decimal between 0 and 1' },
        { status: 400 },
      )
    }
    data.taxRate = body.taxRate
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await prisma.sM_Settings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  })
  return NextResponse.json({ ok: true })
}
