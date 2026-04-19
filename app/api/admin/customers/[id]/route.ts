import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface PatchBody {
  notes?: string
  birthday?: string | null
  wholesaleDiscountPct?: number
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await req.json()) as PatchBody

  const data: {
    notes?: string
    birthday?: Date | null
    wholesaleDiscountPct?: number
  } = {}

  if (typeof body.notes === 'string') data.notes = body.notes

  if (body.birthday !== undefined) {
    if (body.birthday === null || body.birthday === '') {
      data.birthday = null
    } else {
      // Expect "YYYY-MM-DD" from the HTML date input; anchor to UTC noon so
      // the birthday-check's month+day comparison is stable across tz shifts.
      const parsed = new Date(`${body.birthday}T12:00:00Z`)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Invalid birthday' }, { status: 400 })
      }
      data.birthday = parsed
    }
  }

  if (body.wholesaleDiscountPct !== undefined) {
    const pct = Number(body.wholesaleDiscountPct)
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      return NextResponse.json(
        { error: 'wholesaleDiscountPct must be an integer between 0 and 100' },
        { status: 400 },
      )
    }
    data.wholesaleDiscountPct = pct
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  try {
    await prisma.sM_Customer.update({ where: { id }, data })
  } catch {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
