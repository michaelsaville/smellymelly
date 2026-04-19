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

type BroadcastKind = 'thank_you' | 're_engagement' | 'birthday'

interface Body {
  kind?: BroadcastKind
  // If true, only report eligibility counts without sending.
  dryRun?: boolean
}

const THANK_YOU_MIN_DAYS = 6
const THANK_YOU_MAX_DAYS = 14
const DORMANT_DAYS = 90
const RE_ENGAGEMENT_COOLDOWN_DAYS = 90

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000)
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as Body
  if (!body.kind) {
    return NextResponse.json({ error: 'kind is required' }, { status: 400 })
  }

  const now = new Date()
  let eligible: Array<{
    id: string
    name: string
    email: string
    firstOrderAt: Date | null
    lastReEngagementAt: Date | null
    birthday: Date | null
    lastBirthdayEmailYear: number | null
  }> = []

  switch (body.kind) {
    case 'thank_you': {
      eligible = await prisma.sM_Customer.findMany({
        where: {
          thankYouEmailSentAt: null,
          firstOrderAt: {
            gte: daysAgo(THANK_YOU_MAX_DAYS),
            lte: daysAgo(THANK_YOU_MIN_DAYS),
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          firstOrderAt: true,
          lastReEngagementAt: true,
          birthday: true,
          lastBirthdayEmailYear: true,
        },
      })
      break
    }
    case 're_engagement': {
      eligible = await prisma.sM_Customer.findMany({
        where: {
          lastOrderAt: { not: null, lt: daysAgo(DORMANT_DAYS) },
          OR: [
            { lastReEngagementAt: null },
            { lastReEngagementAt: { lt: daysAgo(RE_ENGAGEMENT_COOLDOWN_DAYS) } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          firstOrderAt: true,
          lastReEngagementAt: true,
          birthday: true,
          lastBirthdayEmailYear: true,
        },
      })
      break
    }
    case 'birthday': {
      const candidates = await prisma.sM_Customer.findMany({
        where: {
          birthday: { not: null },
          OR: [
            { lastBirthdayEmailYear: null },
            { lastBirthdayEmailYear: { lt: now.getUTCFullYear() } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          firstOrderAt: true,
          lastReEngagementAt: true,
          birthday: true,
          lastBirthdayEmailYear: true,
        },
      })
      eligible = candidates.filter(
        (c) =>
          c.birthday &&
          c.birthday.getUTCMonth() === now.getUTCMonth() &&
          c.birthday.getUTCDate() === now.getUTCDate(),
      )
      break
    }
    default:
      return NextResponse.json({ error: 'Unknown broadcast kind' }, { status: 400 })
  }

  if (body.dryRun) {
    return NextResponse.json({
      kind: body.kind,
      eligibleCount: eligible.length,
      eligible: eligible.map((c) => ({ name: c.name, email: c.email })),
    })
  }

  const results = { sent: 0, failed: 0, errors: [] as string[] }

  for (const customer of eligible) {
    try {
      if (body.kind === 'thank_you') {
        await sendThankYouEmail(customer)
        await prisma.sM_Customer.update({
          where: { id: customer.id },
          data: { thankYouEmailSentAt: now },
        })
      } else if (body.kind === 're_engagement') {
        await sendReEngagementEmail(customer)
        await prisma.sM_Customer.update({
          where: { id: customer.id },
          data: { lastReEngagementAt: now },
        })
      } else if (body.kind === 'birthday') {
        await sendBirthdayEmail(customer)
        await prisma.sM_Customer.update({
          where: { id: customer.id },
          data: { lastBirthdayEmailYear: now.getUTCFullYear() },
        })
      }
      results.sent++
    } catch (err) {
      results.failed++
      results.errors.push(
        `${customer.email}: ${err instanceof Error ? err.message : String(err)}`,
      )
      console.error(`[broadcast] ${body.kind} to ${customer.email} failed:`, err)
    }
  }

  return NextResponse.json({
    kind: body.kind,
    eligibleCount: eligible.length,
    ...results,
  })
}
