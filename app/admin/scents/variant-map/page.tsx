import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'
import { resolveScents, parseVariantScent } from '@/app/lib/scent-resolver'
import { VariantMapManager } from './VariantMapManager'

export const dynamic = 'force-dynamic'

// Pure size strings ("4oz", "8oz") show up when a variant has no scent
// prefix — those aren't scents and shouldn't appear in the unmatched list.
const SIZE_ONLY_RE = /^\d+(?:\.\d+)?\s*(oz|ml|g|lb)$/i

/**
 * Admin: variant-to-scent reconciliation. Lists every distinct scent
 * prefix parsed out of active product variants, marks which already
 * resolve (direct match on SM_Scent.name or via SM_ScentAlias), and
 * lets Mel map the rest by either picking an existing scent (creates
 * an alias) or adding a new SM_Scent.
 */
export default async function VariantMapPage() {
  const [variants, scents, aliases] = await Promise.all([
    prisma.sM_ProductVariant.findMany({
      where: {
        isActive: true,
        product: { isActive: true },
      },
      select: {
        id: true,
        name: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.sM_Scent.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.sM_ScentAlias.findMany({
      orderBy: { alias: 'asc' },
      select: {
        id: true,
        alias: true,
        scent: { select: { id: true, name: true } },
      },
    }),
  ])

  // Group variants by their parsed scent prefix (lowercased key).
  type VariantRef = { id: string; name: string; productName: string; productSlug: string }
  const groups = new Map<string, { display: string; variants: VariantRef[] }>()
  for (const v of variants) {
    const prefix = parseVariantScent(v.name)
    if (!prefix || SIZE_ONLY_RE.test(prefix)) continue
    const key = prefix.toLowerCase()
    const g = groups.get(key)
    const ref: VariantRef = {
      id: v.id,
      name: v.name,
      productName: v.product.name,
      productSlug: v.product.slug,
    }
    if (g) g.variants.push(ref)
    else groups.set(key, { display: prefix, variants: [ref] })
  }

  const allPrefixes = Array.from(groups.values()).map((g) => g.display)
  const resolution = await resolveScents(allPrefixes)

  const matchedRows: Array<{
    key: string
    display: string
    canonicalName: string
    source: 'direct' | 'alias'
    variantCount: number
  }> = []
  const unmatchedRows: Array<{
    key: string
    display: string
    variants: VariantRef[]
    suggestion: { id: string; name: string } | null
  }> = []

  for (const [key, g] of groups) {
    const r = resolution.get(key)
    if (r && r.source !== 'none') {
      matchedRows.push({
        key,
        display: g.display,
        canonicalName: r.canonicalName,
        source: r.source,
        variantCount: g.variants.length,
      })
    } else {
      unmatchedRows.push({
        key,
        display: g.display,
        variants: g.variants,
        suggestion: closestScent(g.display, scents),
      })
    }
  }

  matchedRows.sort((a, b) => a.display.localeCompare(b.display))
  unmatchedRows.sort((a, b) => a.display.localeCompare(b.display))

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/scents"
            className="text-xs text-brand-brown/60 hover:text-brand-terra"
          >
            ← back to scents
          </Link>
          <h1 className="mt-1 font-display text-2xl font-bold text-brand-dark">
            Variant scent map
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-brand-brown/60">
            The customer-facing product page resolves scent descriptions by
            matching the variant&apos;s scent prefix to an{' '}
            <Link
              href="/admin/scents"
              className="underline hover:text-brand-terra"
            >
              SM_Scent
            </Link>
            . Variants whose prefix doesn&apos;t exactly match are listed
            below — pick an existing scent (creates an alias) or add it as
            a new scent.
          </p>
        </div>
      </div>

      <VariantMapManager
        scents={scents}
        unmatched={unmatchedRows}
        matched={matchedRows}
        aliases={aliases.map((a) => ({
          id: a.id,
          alias: a.alias,
          scentId: a.scent.id,
          scentName: a.scent.name,
        }))}
      />
    </div>
  )
}

// Tiny Levenshtein for "closest scent" suggestions on unmatched variant
// prefixes. Inputs are short (scent names < 40 chars), call set is small
// (variants × scents < 5000), and it runs once at page render — no need
// for a dep.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length]
}

function closestScent(
  prefix: string,
  scents: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  const a = prefix.toLowerCase()
  let best: { id: string; name: string; dist: number } | null = null
  for (const s of scents) {
    const d = levenshtein(a, s.name.toLowerCase())
    if (best === null || d < best.dist) best = { ...s, dist: d }
  }
  // Only suggest if the edit distance is reasonable relative to length —
  // otherwise the suggestion is noise (e.g., "Tobacco Vanilla" is not
  // helpfully closest to "Vanilla").
  if (!best) return null
  const threshold = Math.max(2, Math.floor(prefix.length / 3))
  return best.dist <= threshold ? { id: best.id, name: best.name } : null
}
