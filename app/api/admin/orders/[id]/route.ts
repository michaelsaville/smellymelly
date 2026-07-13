import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { sendShippingNotification } from '@/app/lib/email'
import { recomputeCustomerStats } from '@/app/lib/customers'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'
import { getSquareClient, isSquareConfigured } from '@/app/lib/square'
import { randomUUID } from 'crypto'
import type { SM_OrderStatus } from '@prisma/client'

const TERMINAL = new Set<SM_OrderStatus>(['CANCELLED', 'REFUNDED'])

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
  markPaidAt?: boolean
  manualPaymentNote?: string | null
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
    paidAt?: Date | null
    manualPaymentNote?: string | null
  } = {}

  if (body.status) data.status = body.status
  if (body.trackingNumber !== undefined) {
    data.trackingNumber = body.trackingNumber?.trim() || null
  }
  if (body.manualPaymentNote !== undefined) {
    data.manualPaymentNote = body.manualPaymentNote?.trim() || null
  }

  // Side effects for specific status transitions
  if (body.status === 'SHIPPED' && !existing.shippedAt) {
    data.shippedAt = new Date()
  }
  if (body.status === 'CANCELLED' && !existing.cancelledAt) {
    data.cancelledAt = new Date()
  }
  // Mark-paid flag: set paidAt if the flag is true and it isn't already set.
  // Usually paired with status → PAID on manual tenders.
  if (body.markPaidAt && !existing.paidAt) {
    data.paidAt = new Date()
  }

  // Restock when an order first moves to a terminal (CANCELLED/REFUNDED) state —
  // its units were deducted at checkout and would otherwise be lost forever.
  // Guard on "was not already terminal" so cancelled→refunded doesn't double-restock.
  const nowTerminal = body.status && TERMINAL.has(body.status) && !TERMINAL.has(existing.status)

  // Issue a REAL refund at the processor when moving to REFUNDED a paid order.
  if (body.status === 'REFUNDED' && existing.status !== 'REFUNDED' && existing.paidAt) {
    try {
      if (existing.stripePaymentIntentId && isStripeConfigured()) {
        // Deterministic idempotency key: if the refund succeeded but the DB
        // status update below failed, a retry returns the SAME refund instead
        // of issuing a second one.
        await getStripe().refunds.create(
          { payment_intent: existing.stripePaymentIntentId },
          { idempotencyKey: `refund_${existing.stripePaymentIntentId}` },
        )
      } else if (existing.squarePaymentId && isSquareConfigured()) {
        await getSquareClient().refunds.refundPayment({
          idempotencyKey: randomUUID(),
          paymentId: existing.squarePaymentId,
        } as never)
      }
    } catch (err) {
      console.error(`[refund] processor refund failed for order ${id}:`, err)
      return NextResponse.json(
        { error: 'Could not process the refund at the payment processor. Order status unchanged.' },
        { status: 502 },
      )
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (nowTerminal) {
      const items = await tx.sM_OrderItem.findMany({ where: { orderId: id }, select: { variantId: true, quantity: true } })
      for (const it of items) {
        if (it.variantId) {
          await tx.sM_ProductVariant.update({
            where: { id: it.variantId },
            data: { stockQuantity: { increment: it.quantity } },
          })
        }
      }
    }
    return tx.sM_Order.update({ where: { id }, data, include: { items: true } })
  })

  // Fire-and-forget shipping email when we transition to SHIPPED with tracking.
  // Matches checkout's pattern: never fail the mutation because mail failed.
  const nowShipped = body.status === 'SHIPPED' && existing.status !== 'SHIPPED'
  if (nowShipped && updated.trackingNumber) {
    sendShippingNotification(updated).catch((err) => {
      console.error(`[email] ship-notif for ${updated.id} failed:`, err)
    })
  }

  // Keep denormalized CRM stats in sync when the counted/uncounted transition
  // could flip (any status change is cheap enough to just always recompute).
  if (body.status && existing.status !== body.status && updated.customerId) {
    recomputeCustomerStats(updated.customerId).catch((err) => {
      console.error(`[crm] recompute for ${updated.customerId} failed:`, err)
    })
  }

  return NextResponse.json({ ok: true })
}
