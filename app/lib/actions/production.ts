'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { convert, materialItemCost } from '@/app/lib/units'

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
          material: {
            select: { id: true, name: true, packageUnit: true, packageCostCents: true, packageSize: true, onHand: true },
          },
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

  const yields = Math.max(1, recipe.yields)
  const added = yields * batches

  // --- Preflight: verify every material is convertible AND in stock BEFORE we
  // mutate anything. Previously a unit mismatch was silently skipped (material
  // never deducted) and onHand could go negative with no warning. ---
  const mismatches: string[] = []
  const shortfalls: string[] = []
  const deductions: { materialId: string; amount: number }[] = []
  let batchCostCents = 0 // material cost for ONE batch (for per-unit COGS)

  for (const it of recipe.items) {
    let usedPerBatch: number
    try {
      usedPerBatch = convert(it.quantity, it.unit, it.material.packageUnit)
    } catch {
      mismatches.push(`${it.material.name} (recipe uses ${it.unit}, purchased in ${it.material.packageUnit})`)
      continue
    }
    const needed = usedPerBatch * batches
    if (it.material.onHand < needed) {
      shortfalls.push(`${it.material.name} (need ${needed.toFixed(2)} ${it.material.packageUnit}, have ${it.material.onHand.toFixed(2)})`)
    }
    deductions.push({ materialId: it.material.id, amount: needed })
    batchCostCents += materialItemCost(
      it.material.packageCostCents, it.material.packageSize, it.material.packageUnit, it.quantity, it.unit,
    )
  }

  if (mismatches.length) {
    return { ok: false, error: `Can't cost/deduct these materials — unit mismatch: ${mismatches.join('; ')}. Fix the recipe units first.` }
  }
  if (shortfalls.length) {
    return { ok: false, error: `Not enough material on hand: ${shortfalls.join('; ')}.` }
  }

  const unitCostCents = Math.round(batchCostCents / yields) // COGS per finished unit

  // Increment finished stock, deduct materials, and persist COGS — atomically.
  const updated = await prisma.$transaction(async (tx) => {
    const v = await tx.sM_ProductVariant.update({
      where: { id: variant.id },
      data: { stockQuantity: { increment: added }, costCents: unitCostCents },
      select: { stockQuantity: true },
    })
    for (const d of deductions) {
      await tx.sM_Material.update({ where: { id: d.materialId }, data: { onHand: { decrement: d.amount } } })
    }
    return v
  })

  revalidatePath('/admin/recipes')
  revalidatePath('/admin/inventory')
  revalidatePath('/admin/materials')
  revalidatePath('/admin/production')
  return { ok: true, added, newStock: updated.stockQuantity }
}
