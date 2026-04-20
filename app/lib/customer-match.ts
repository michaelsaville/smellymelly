import { prisma } from './prisma'

export interface CustomerCandidate {
  id: string
  name: string
  email: string
  phone: string | null
  score: number
  reason: string
}

function normalize(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function digitsOnly(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '')
}

/**
 * Dumb-but-decent fuzzy match. Loads all customers (fine at SM's scale) and
 * scores each by name-token overlap plus phone last-7 match.
 */
export async function findCustomerMatches(
  extracted: { name?: string | null; phone?: string | null; email?: string | null },
  limit = 5,
): Promise<CustomerCandidate[]> {
  const name = normalize(extracted.name)
  const email = normalize(extracted.email)
  const phoneLast7 = digitsOnly(extracted.phone).slice(-7)

  if (!name && !email && !phoneLast7) return []

  // Exact email wins outright.
  if (email) {
    const byEmail = await prisma.sM_Customer.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, phone: true },
    })
    if (byEmail) {
      return [
        {
          ...byEmail,
          score: 1,
          reason: 'Exact email match',
        },
      ]
    }
  }

  const customers = await prisma.sM_Customer.findMany({
    select: { id: true, name: true, email: true, phone: true },
  })

  const nameTokens = name.split(' ').filter((t) => t.length >= 2)

  const scored = customers
    .map((c) => {
      const cName = normalize(c.name)
      const cTokens = new Set(cName.split(' ').filter((t) => t.length >= 2))
      const cPhone7 = digitsOnly(c.phone).slice(-7)

      let score = 0
      const reasons: string[] = []

      // Name token overlap
      if (nameTokens.length) {
        const hits = nameTokens.filter((t) => cTokens.has(t)).length
        if (hits > 0) {
          const tokenScore = hits / Math.max(nameTokens.length, cTokens.size)
          score += tokenScore * 0.6
          reasons.push(`name tokens ${hits}/${nameTokens.length}`)
        }
        // Substring fallback (helps with "Marge" vs "Margaret")
        if (!reasons.length && cName && name.length >= 3 && cName.includes(name)) {
          score += 0.5
          reasons.push('name substring')
        }
      }

      // Phone match
      if (phoneLast7 && cPhone7 && phoneLast7 === cPhone7) {
        score += 0.6
        reasons.push('phone match')
      }

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        score,
        reason: reasons.join(', '),
      }
    })
    .filter((c) => c.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}
