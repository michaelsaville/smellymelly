'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import type { SM_DiscountType } from '@prisma/client'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

export interface DiscountInput {
  code: string
  type: SM_DiscountType
  value: number
  maxUses: number
  minSubtotalCents: number
  expiresAt: string | null // yyyy-mm-dd or null
  notes: string | null
}

function normalize(input: DiscountInput): {
  code: string
  type: SM_DiscountType
  value: number
  maxUses: number
  minSubtotalCents: number
  expiresAt: Date | null
  notes: string | null
} | { error: string } {
  const code = input.code.trim().toUpperCase()
  if (!/^[A-Z0-9._-]{2,40}$/.test(code)) {
    return { error: 'Code must be 2–40 letters, numbers, or . _ - (no spaces).' }
  }
  if (input.type !== 'PERCENT' && input.type !== 'FIXED') {
    return { error: 'Invalid discount type.' }
  }
  if (!Number.isFinite(input.value) || input.value <= 0) {
    return { error: 'Value must be greater than zero.' }
  }
  if (input.type === 'PERCENT' && input.value > 100) {
    return { error: 'Percent discount cannot exceed 100.' }
  }
  const value = Math.round(input.value)
  const maxUses = Math.max(0, Math.round(input.maxUses || 0))
  const minSubtotalCents = Math.max(0, Math.round(input.minSubtotalCents || 0))
  let expiresAt: Date | null = null
  if (input.expiresAt) {
    // Treat as end-of-day local so the code is valid through the chosen date.
    const d = new Date(`${input.expiresAt}T23:59:59`)
    if (isNaN(d.getTime())) return { error: 'Invalid expiry date.' }
    expiresAt = d
  }
  return {
    code,
    type: input.type,
    value,
    maxUses,
    minSubtotalCents,
    expiresAt,
    notes: input.notes?.trim() || null,
  }
}

export async function createDiscount(input: DiscountInput): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const n = normalize(input)
  if ('error' in n) return { ok: false, error: n.error }

  const existing = await prisma.sM_DiscountCode.findUnique({ where: { code: n.code } })
  if (existing) return { ok: false, error: `Code "${n.code}" already exists.` }

  await prisma.sM_DiscountCode.create({ data: n })
  revalidatePath('/admin/discounts')
  return { ok: true }
}

export async function updateDiscount(
  id: string,
  input: DiscountInput,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const n = normalize(input)
  if ('error' in n) return { ok: false, error: n.error }

  // Guard the unique code against colliding with a different row.
  const clash = await prisma.sM_DiscountCode.findUnique({ where: { code: n.code } })
  if (clash && clash.id !== id) return { ok: false, error: `Code "${n.code}" already exists.` }

  await prisma.sM_DiscountCode.update({ where: { id }, data: n })
  revalidatePath('/admin/discounts')
  return { ok: true }
}

export async function toggleDiscount(id: string, isActive: boolean): Promise<{ ok: boolean }> {
  await requireAdmin()
  await prisma.sM_DiscountCode.update({ where: { id }, data: { isActive } })
  revalidatePath('/admin/discounts')
  return { ok: true }
}

export async function deleteDiscount(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  await prisma.sM_DiscountCode.delete({ where: { id } })
  revalidatePath('/admin/discounts')
  return { ok: true }
}
