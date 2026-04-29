import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface CategoryUpdate {
  id: string
  baseIngredients: string
}

interface Body {
  venmoHandle?: string
  cashAppTag?: string
  paymentInstructions?: string
  taxRate?: number
  productDisclaimer?: string
  categories?: CategoryUpdate[]
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
    productDisclaimer?: string
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
  if (typeof body.productDisclaimer === 'string') {
    data.productDisclaimer = body.productDisclaimer
  }

  const categoryUpdates = Array.isArray(body.categories)
    ? body.categories.filter(
        (c): c is CategoryUpdate =>
          !!c &&
          typeof c.id === 'string' &&
          typeof c.baseIngredients === 'string',
      )
    : []

  if (Object.keys(data).length === 0 && categoryUpdates.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await prisma.$transaction([
    ...(Object.keys(data).length > 0
      ? [
          prisma.sM_Settings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', ...data },
            update: data,
          }),
        ]
      : []),
    ...categoryUpdates.map((c) =>
      prisma.sM_Category.update({
        where: { id: c.id },
        data: { baseIngredients: c.baseIngredients || null },
      }),
    ),
  ])
  return NextResponse.json({ ok: true })
}
