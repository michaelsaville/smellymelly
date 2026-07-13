import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { parseVariantScent } from '@/app/lib/variant-name'
import { classifyScent, scoreFamilies, type FamilyKey } from '@/app/lib/scent-families'

type ProductRef = { slug: string; name: string; stock: number }

export async function POST(req: NextRequest) {
  let answers: Record<string, number>
  try {
    const body = await req.json()
    answers = body.answers ?? {}
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  const weights = scoreFamilies(answers)
  const targetFamilies = (Object.keys(weights) as FamilyKey[]).filter((k) => weights[k] > 0)

  const [scents, products] = await Promise.all([
    prisma.sM_Scent.findMany({
      where: { isActive: true },
      select: { name: true, description: true },
    }),
    prisma.sM_Product.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        name: true,
        scent: true,
        variants: { where: { isActive: true }, select: { name: true, stockQuantity: true } },
      },
    }),
  ])

  // Build a scent(lowercased) -> best product carrying it.
  const scentToProduct = new Map<string, ProductRef>()
  const consider = (scentName: string, ref: ProductRef) => {
    const key = scentName.trim().toLowerCase()
    if (!key) return
    const cur = scentToProduct.get(key)
    if (!cur || ref.stock > cur.stock) scentToProduct.set(key, ref)
  }
  for (const p of products) {
    if (p.scent) consider(p.scent, { slug: p.slug, name: p.name, stock: 0 })
    for (const v of p.variants) {
      consider(parseVariantScent(v.name), { slug: p.slug, name: p.name, stock: v.stockQuantity })
    }
  }

  // Score each scent by how well its families match the quiz weights.
  const scored = scents
    .map((s) => {
      const families = classifyScent(s.name, s.description)
      const score = families.reduce((sum, f) => sum + (weights[f] ?? 0), 0)
      return { name: s.name, description: s.description, families, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  // Take the top scents that are actually buyable, dedupe by product.
  const recommendations: {
    scent: string
    description: string | null
    productSlug: string
    productName: string
    families: string[]
  }[] = []
  const usedProducts = new Set<string>()
  for (const s of scored) {
    const ref = scentToProduct.get(s.name.trim().toLowerCase())
    if (!ref) continue
    recommendations.push({
      scent: s.name,
      description: s.description,
      productSlug: ref.slug,
      productName: ref.name,
      families: s.families.map((f) => f),
    })
    usedProducts.add(ref.slug)
    if (recommendations.length >= 4) break
  }

  return NextResponse.json({
    recommendations,
    families: targetFamilies,
  })
}
