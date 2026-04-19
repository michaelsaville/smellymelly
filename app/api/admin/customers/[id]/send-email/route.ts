import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import {
  sendThankYouEmail,
  sendReEngagementEmail,
  sendBirthdayEmail,
} from '@/app/lib/email'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

type Kind = 'thank_you' | 're_engagement' | 'birthday'

interface Body {
  kind?: Kind
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await req.json()) as Body
  if (!body.kind) {
    return NextResponse.json({ error: 'kind is required' }, { status: 400 })
  }

  const customer = await prisma.sM_Customer.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  })
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  try {
    const now = new Date()
    if (body.kind === 'thank_you') {
      await sendThankYouEmail(customer)
      await prisma.sM_Customer.update({
        where: { id },
        data: { thankYouEmailSentAt: now },
      })
    } else if (body.kind === 're_engagement') {
      await sendReEngagementEmail(customer)
      await prisma.sM_Customer.update({
        where: { id },
        data: { lastReEngagementAt: now },
      })
    } else if (body.kind === 'birthday') {
      await sendBirthdayEmail(customer)
      await prisma.sM_Customer.update({
        where: { id },
        data: { lastBirthdayEmailYear: now.getUTCFullYear() },
      })
    } else {
      return NextResponse.json({ error: 'Unknown kind' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(`[send-email] ${body.kind} to ${customer.email} failed:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Send failed' },
      { status: 500 },
    )
  }
}
