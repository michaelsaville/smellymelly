'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { requireAdmin } from '@/app/lib/admin-auth'
import {
  PAGE_TEXT_REGISTRY,
  fallbackFor,
} from '@/app/lib/page-text'

export type PageTextResult = { ok: true } | { ok: false; error: string }

const REGISTERED_KEYS = new Set(PAGE_TEXT_REGISTRY.map((f) => f.key))

/**
 * Upsert a copy override for a single registered key. An empty string
 * value deletes the row so the next render falls back to the in-code
 * default — lets Mel "reset to original" just by clearing the field.
 */
export async function savePageText(
  key: string,
  value: string,
): Promise<PageTextResult> {
  await requireAdmin()
  if (!REGISTERED_KEYS.has(key)) {
    return { ok: false, error: 'Unknown copy key' }
  }
  const trimmed = value.replace(/\r\n/g, '\n')
  try {
    if (trimmed === '' || trimmed === fallbackFor(key)) {
      await prisma.sM_PageText.delete({ where: { key } }).catch(() => {})
    } else {
      await prisma.sM_PageText.upsert({
        where: { key },
        create: { key, value: trimmed },
        update: { value: trimmed },
      })
    }
  } catch (e) {
    console.error('[page-text] save failed', e)
    return { ok: false, error: 'Failed to save' }
  }
  revalidatePath('/about')
  revalidatePath('/admin/copy')
  return { ok: true }
}

/** Delete an override — forces fallback render. */
export async function resetPageText(key: string): Promise<PageTextResult> {
  await requireAdmin()
  if (!REGISTERED_KEYS.has(key)) {
    return { ok: false, error: 'Unknown copy key' }
  }
  try {
    await prisma.sM_PageText.delete({ where: { key } }).catch(() => {})
  } catch (e) {
    console.error('[page-text] reset failed', e)
    return { ok: false, error: 'Failed to reset' }
  }
  revalidatePath('/about')
  revalidatePath('/admin/copy')
  return { ok: true }
}
