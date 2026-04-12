import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await req.json()) as { stockQuantity?: number }

  if (typeof body.stockQuantity !== 'number' || body.stockQuantity < 0) {
    return NextResponse.json({ error: 'Invalid stock quantity' }, { status: 400 })
  }

  try {
    const variant = await prisma.sM_ProductVariant.update({
      where: { id },
      data: { stockQuantity: body.stockQuantity },
    })
    return NextResponse.json({ data: variant })
  } catch {
    return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  }
}
