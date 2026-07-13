import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'
import { parseFilters, buildWhere } from '@/app/lib/order-views'
import { parseVariantScent } from '@/app/lib/variant-name'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

// RFC 4180 — wrap every field in quotes, escape embedded quotes.
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""'
  return `"${String(value).replace(/"/g, '""')}"`
}
function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(',')
}

function easternDate(d: Date | null): string {
  if (!d) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export async function GET(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const filters = parseFilters((k) => url.searchParams.get(k))
  const where = buildWhere(filters) as Prisma.SM_OrderWhereInput

  const orders = await prisma.sM_Order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  })

  const header = [
    'Order #',
    'Created (ET)',
    'Paid (ET)',
    'Status',
    'Fulfillment',
    'Payment',
    'Customer',
    'Email',
    'Phone',
    'Items',
    'Subtotal',
    'Tax',
    'Shipping',
    'Total',
    'Source',
  ]

  const rows: string[] = [toCsvRow(header)]
  for (const o of orders) {
    const items = o.items
      .map((i) => {
        const scent = parseVariantScent(i.variantName)
        const scentTag = scent && scent.toLowerCase() !== 'standard' ? ` (${scent})` : ''
        return `${i.quantity}x ${i.productName}${scentTag}`
      })
      .join('; ')
    rows.push(
      toCsvRow([
        o.orderNumber,
        easternDate(o.createdAt),
        easternDate(o.paidAt),
        o.status,
        o.fulfillment,
        o.paymentMethod,
        o.customerName,
        o.customerEmail,
        o.customerPhone ?? '',
        items,
        (o.subtotalCents / 100).toFixed(2),
        (o.taxCents / 100).toFixed(2),
        (o.shippingCents / 100).toFixed(2),
        (o.totalCents / 100).toFixed(2),
        o.campaignId ? 'Fundraiser' : 'Storefront',
      ]),
    )
  }

  const csv = rows.join('\r\n') + '\r\n'
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="smellymelly-orders-${date}.csv"`,
    },
  })
}
