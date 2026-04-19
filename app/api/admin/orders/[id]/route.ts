import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { sendShippingNotification } from '@/app/lib/email'
import type { SM_OrderStatus } from '@prisma/client'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

const VALID_STATUSES: SM_OrderStatus[] = [
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'PICKED_UP',
  'CANCELLED',
  'REFUNDED',
]

interface PatchBody {
  status?: SM_OrderStatus
  trackingNumber?: string | null
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

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const existing = await prisma.sM_Order.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const data: {
    status?: SM_OrderStatus
    trackingNumber?: string | null
    shippedAt?: Date | null
    cancelledAt?: Date | null
  } = {}

  if (body.status) data.status = body.status
  if (body.trackingNumber !== undefined) {
    data.trackingNumber = body.trackingNumber?.trim() || null
  }

  // Side effects for specific status transitions
  if (body.status === 'SHIPPED' && !existing.shippedAt) {
    data.shippedAt = new Date()
  }
  if (body.status === 'CANCELLED' && !existing.cancelledAt) {
    data.cancelledAt = new Date()
  }

  const updated = await prisma.sM_Order.update({
    where: { id },
    data,
    include: { items: true },
  })

  // Fire-and-forget shipping email when we transition to SHIPPED with tracking.
  // Matches checkout's pattern: never fail the mutation because mail failed.
  const nowShipped = body.status === 'SHIPPED' && existing.status !== 'SHIPPED'
  if (nowShipped && updated.trackingNumber) {
    sendShippingNotification(updated).catch((err) => {
      console.error(`[email] ship-notif for ${updated.id} failed:`, err)
    })
  }

  return NextResponse.json({ ok: true })
}
