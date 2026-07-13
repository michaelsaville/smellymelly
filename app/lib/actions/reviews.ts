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

export async function setReviewApproved(id: string, approved: boolean): Promise<{ ok: boolean }> {
  await requireAdmin()
  await prisma.sM_Review.update({ where: { id }, data: { isApproved: approved } })
  revalidatePath('/admin/reviews')
  return { ok: true }
}

export async function deleteReview(id: string): Promise<{ ok: boolean }> {
  await requireAdmin()
  await prisma.sM_Review.delete({ where: { id } })
  revalidatePath('/admin/reviews')
  return { ok: true }
}
