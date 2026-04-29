import { prisma } from '@/app/lib/prisma'

export type AllergenSeverity = 'high' | 'normal'

export interface AllergenMatch {
  label: string
  severity: AllergenSeverity
}

// Comma-separated user input → /\b(term1|term2|...)\b/i.
// User-typed terms get regex-escaped so a stray "." or "(" doesn't blow up.
function buildPattern(matchTerms: string): RegExp | null {
  const terms = matchTerms
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (terms.length === 0) return null
  return new RegExp(`\\b(${terms.join('|')})\\b`, 'i')
}

function normalizeSeverity(s: string): AllergenSeverity {
  return s === 'high' ? 'high' : 'normal'
}

export async function detectAllergens(
  ...sources: (string | null | undefined)[]
): Promise<AllergenMatch[]> {
  const text = sources.filter((s): s is string => !!s).join(' ')
  if (!text) return []

  const allergens = await prisma.sM_Allergen.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { label: true, matchTerms: true, severity: true },
  })

  const hits: AllergenMatch[] = []
  for (const a of allergens) {
    const pat = buildPattern(a.matchTerms)
    if (pat && pat.test(text)) {
      hits.push({ label: a.label, severity: normalizeSeverity(a.severity) })
    }
  }
  return hits
}
