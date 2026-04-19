import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { type Segment, segmentWhere } from '@/app/lib/customer-segments'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

const SEGMENT_VALUES: Segment[] = [
  'all',
  'repeat',
  'big_spenders',
  'dormant',
  'pickup_only',
  'has_shipped',
  'new',
]

// RFC 4180 — wrap every field in quotes, escape embedded quotes.
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}

function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(',')
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const segmentParam = url.searchParams.get('segment') as Segment | null
  const segment: Segment = SEGMENT_VALUES.includes(segmentParam as Segment)
    ? (segmentParam as Segment)
    : 'all'
  const search = url.searchParams.get('q')?.trim() ?? ''
  const tag = url.searchParams.get('tag')?.trim() ?? ''

  const baseWhere = segmentWhere(segment, search || undefined)
  const where = tag
    ? {
        AND: [
          baseWhere,
          {
            tags: {
              some: {
                tag: { name: { equals: tag, mode: 'insensitive' as const } },
              },
            },
          },
        ],
      }
    : baseWhere

  const customers = await prisma.sM_Customer.findMany({
    where,
    orderBy: [{ totalSpentCents: 'desc' }, { lastOrderAt: 'desc' }],
    include: {
      tags: { include: { tag: { select: { name: true } } } },
    },
  })

  const header = [
    'Name',
    'Email',
    'Phone',
    'Order Count',
    'Lifetime Spend',
    'First Order',
    'Last Order',
    'Tags',
    'Birthday',
    'Wholesale %',
    'Last Ship Address',
    'Last Ship City',
    'Last Ship State',
    'Last Ship ZIP',
    'Notes',
  ]

  const rows: string[] = [toCsvRow(header)]
  for (const c of customers) {
    rows.push(
      toCsvRow([
        c.name,
        c.email,
        c.phone ?? '',
        c.orderCount,
        (c.totalSpentCents / 100).toFixed(2),
        c.firstOrderAt?.toISOString().slice(0, 10) ?? '',
        c.lastOrderAt?.toISOString().slice(0, 10) ?? '',
        c.tags.map((t) => t.tag.name).join('; '),
        c.birthday?.toISOString().slice(0, 10) ?? '',
        c.wholesaleDiscountPct,
        c.lastShipAddress ?? '',
        c.lastShipCity ?? '',
        c.lastShipState ?? '',
        c.lastShipZip ?? '',
        c.notes.replace(/\r?\n/g, ' | '),
      ]),
    )
  }

  const csv = rows.join('\r\n') + '\r\n'
  const date = new Date().toISOString().slice(0, 10)
  const filename = `smellymelly-customers-${segment}-${date}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
