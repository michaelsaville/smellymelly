'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { convert } from '@/app/lib/units'

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
    select: {
      yields: true,
      items: {
        select: {
          quantity: true,
          unit: true,
          material: { select: { id: true, packageUnit: true } },
        },
      },
    },
  })
  if (!recipe) return { ok: false, error: 'Recipe not found.' }

  const variant = await prisma.sM_ProductVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, name: true },
  })
  if (!variant) return { ok: false, error: 'Pick a variant to add stock to.' }

  const added = Math.max(1, recipe.yields) * batches

  // Increment finished stock and deduct the materials used, atomically.
  const updated = await prisma.$transaction(async (tx) => {
    const v = await tx.sM_ProductVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: { increment: added } },
      select: { stockQuantity: true },
    })
    for (const it of recipe.items) {
      let usedInPkgUnit: number
      try {
        usedInPkgUnit = convert(it.quantity, it.unit, it.material.packageUnit) * batches
      } catch {
        // Unit types don't match (weight vs volume) — can't deduct; skip.
        continue
      }
      await tx.sM_Material.update({
        where: { id: it.material.id },
        data: { onHand: { decrement: usedInPkgUnit } },
      })
    }
    return v
  })

  revalidatePath('/admin/recipes')
  revalidatePath('/admin/inventory')
  revalidatePath('/admin/materials')
  revalidatePath('/admin/production')
  return { ok: true, added, newStock: updated.stockQuantity }
}
