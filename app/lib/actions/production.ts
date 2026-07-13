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

// Record a production run: add (recipe.yields × batches) finished units to a
// chosen variant's stock. Closes the recipe→inventory loop (checkout decrements
// stock; this is the only thing that increments it from production).
export async function makeBatch(input: {
  recipeId: string
  variantId: string
  batches: number
}): Promise<{ ok: true; added: number; newStock: number } | { ok: false; error: string }> {
  await requireAdmin()

  const batches = Math.floor(input.batches)
  if (!batches || batches < 1) return { ok: false, error: 'Enter at least 1 batch.' }

  const recipe = await prisma.sM_Recipe.findUnique({
    where: { id: input.recipeId },
    select: { yields: true },
  })
  if (!recipe) return { ok: false, error: 'Recipe not found.' }

  const variant = await prisma.sM_ProductVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, name: true },
  })
  if (!variant) return { ok: false, error: 'Pick a variant to add stock to.' }

  const added = Math.max(1, recipe.yields) * batches
  const updated = await prisma.sM_ProductVariant.update({
    where: { id: variant.id },
    data: { stockQuantity: { increment: added } },
    select: { stockQuantity: true },
  })

  revalidatePath('/admin/recipes')
  revalidatePath('/admin/inventory')
  return { ok: true, added, newStock: updated.stockQuantity }
}
