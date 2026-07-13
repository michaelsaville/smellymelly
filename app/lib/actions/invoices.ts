'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { SM_InvoiceStatus } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

export async function createInvoice(data: {
  customerName: string
  customerEmail?: string
  notes?: string
  taxRatePct?: number
  items: { description: string; quantity: number; unitCents: number }[]
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await requireAdmin()
  const customerName = data.customerName.trim()
  if (!customerName) return { ok: false, error: 'Customer name is required.' }

  const items = data.items
    .map((it) => ({
      description: it.description.trim(),
      quantity: Math.max(1, Math.round(it.quantity)),
      unitCents: Math.max(0, Math.round(it.unitCents)),
    }))
    .filter((it) => it.description && it.unitCents >= 0)
  if (items.length === 0) return { ok: false, error: 'Add at least one line item.' }

  const subtotalCents = items.reduce((s, it) => s + it.quantity * it.unitCents, 0)
  const taxCents = Math.round(subtotalCents * ((data.taxRatePct ?? 0) / 100))
  const totalCents = subtotalCents + taxCents

  const invoice = await prisma.sM_Invoice.create({
    data: {
      customerName,
      customerEmail: data.customerEmail?.trim() || null,
      notes: data.notes?.trim() || null,
      subtotalCents,
      taxCents,
      totalCents,
      items: {
        create: items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitCents: it.unitCents,
          totalCents: it.quantity * it.unitCents,
        })),
      },
    },
  })
  revalidatePath('/admin/invoices')
  return { ok: true, id: invoice.id }
}

export async function setInvoiceStatus(
  id: string,
  status: SM_InvoiceStatus,
): Promise<{ ok: boolean }> {
  await requireAdmin()
  const data: { status: SM_InvoiceStatus; sentAt?: Date; paidAt?: Date } = { status }
  if (status === 'SENT') data.sentAt = new Date()
  if (status === 'PAID') data.paidAt = new Date()
  await prisma.sM_Invoice.update({ where: { id }, data })
  revalidatePath('/admin/invoices')
  revalidatePath(`/admin/invoices/${id}`)
  return { ok: true }
}

export async function deleteInvoice(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  await prisma.sM_InvoiceItem.deleteMany({ where: { invoiceId: id } })
  await prisma.sM_Invoice.delete({ where: { id } })
  revalidatePath('/admin/invoices')
  return { ok: true }
}
