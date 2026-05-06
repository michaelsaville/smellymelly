import 'server-only'
import { prisma } from '@/app/lib/prisma'

// Resolves variant-side scent strings (parsed prefixes like "Lavender",
// "Bubblegum", "chamomile & Lavander") to a canonical SM_Scent + its
// customer-facing description. Used by the /shop/[slug] sales page to
// surface scent descriptions per variant, and by /admin/scents/variant-map
// to show which variant strings still need a mapping.
//
// Match order:
//   1. exact (case-insensitive) match on SM_Scent.name
//   2. case-insensitive match on SM_ScentAlias.alias → SM_Scent
//   3. unmatched

export type ScentResolution =
  | {
      source: 'direct' | 'alias'
      scentId: string
      canonicalName: string
      description: string | null
    }
  | { source: 'none' }

export type ScentResolutionMap = Map<string, ScentResolution>

function key(s: string): string {
  return s.trim().toLowerCase()
}

export async function resolveScents(
  variantScentStrings: string[],
): Promise<ScentResolutionMap> {
  const map: ScentResolutionMap = new Map()
  const cleaned = Array.from(
    new Set(variantScentStrings.map((s) => s.trim()).filter((s) => s.length > 0)),
  )
  if (cleaned.length === 0) return map

  const [scents, aliases] = await Promise.all([
    prisma.sM_Scent.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
    }),
    prisma.sM_ScentAlias.findMany({
      select: {
        alias: true,
        scent: { select: { id: true, name: true, description: true, isActive: true } },
      },
    }),
  ])

  const byName = new Map<string, (typeof scents)[number]>()
  for (const s of scents) byName.set(key(s.name), s)

  const byAlias = new Map<
    string,
    { id: string; name: string; description: string | null }
  >()
  for (const a of aliases) {
    if (!a.scent.isActive) continue
    byAlias.set(key(a.alias), {
      id: a.scent.id,
      name: a.scent.name,
      description: a.scent.description,
    })
  }

  for (const input of cleaned) {
    const k = key(input)
    const direct = byName.get(k)
    if (direct) {
      map.set(k, {
        source: 'direct',
        scentId: direct.id,
        canonicalName: direct.name,
        description: direct.description,
      })
      continue
    }
    const alias = byAlias.get(k)
    if (alias) {
      map.set(k, {
        source: 'alias',
        scentId: alias.id,
        canonicalName: alias.name,
        description: alias.description,
      })
      continue
    }
    map.set(k, { source: 'none' })
  }

  return map
}

export function lookupScent(
  map: ScentResolutionMap,
  scentString: string,
): ScentResolution | null {
  return map.get(key(scentString)) ?? null
}

// Parses the scent prefix out of a variant name. Mirrors the client-side
// parseVariant() in app/shop/[slug]/AddToCart.tsx so resolver inputs match
// what the picker shows. "Lavender - 4oz" -> "Lavender". "Peppermint" -> "Peppermint".
const SIZE_RE = /^(\d+(?:\.\d+)?)\s*(oz|ml|g|lb)$/i
export function parseVariantScent(variantName: string): string {
  const idx = variantName.lastIndexOf(' - ')
  if (idx >= 0) {
    const tail = variantName.slice(idx + 3).trim()
    if (SIZE_RE.test(tail)) return variantName.slice(0, idx).trim()
  }
  return variantName.trim()
}
