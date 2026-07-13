'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

export async function setInquiryStatus(id: string, status: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  const allowed = ['NEW', 'IN_PROGRESS', 'CLOSED']
  if (!allowed.includes(status)) return { ok: false }
  await prisma.sM_Inquiry.update({ where: { id }, data: { status } })
  revalidatePath('/admin/inquiries')
  return { ok: true }
}

export async function deleteInquiry(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  await prisma.sM_Inquiry.delete({ where: { id } })
  revalidatePath('/admin/inquiries')
  return { ok: true }
}
