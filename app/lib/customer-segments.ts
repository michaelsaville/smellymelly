import type { Prisma } from '@prisma/client'

export type Segment =
  | 'all'
  | 'repeat'
  | 'big_spenders'
  | 'dormant'
  | 'pickup_only'
  | 'has_shipped'
  | 'new'

export const SEGMENT_LABELS: Record<Segment, string> = {
  all: 'All',
  repeat: 'Repeat buyers',
  big_spenders: 'Big spenders ($100+)',
  dormant: 'Dormant (90+ days)',
  pickup_only: 'Pickup only',
  has_shipped: 'Had a shipped order',
  new: 'New (first 30 days)',
}

const BIG_SPENDER_CENTS = 10_000
const DORMANT_DAYS = 90
const NEW_DAYS = 30

/**
 * Translates a segment name into a Prisma `where` clause for SM_Customer.
 * Some segments require relational filters; those leverage `orders` with
 * `some` / `none` predicates so the DB does the filtering.
 */
export function segmentWhere(
  segment: Segment,
  search?: string,
): Prisma.SM_CustomerWhereInput {
  const now = new Date()
  const dormantCutoff = new Date(now.getTime() - DORMANT_DAYS * 86_400_000)
  const newCutoff = new Date(now.getTime() - NEW_DAYS * 86_400_000)

  const searchFilter: Prisma.SM_CustomerWhereInput | undefined = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined

  let segmentFilter: Prisma.SM_CustomerWhereInput = {}
  switch (segment) {
    case 'repeat':
      segmentFilter = { orderCount: { gte: 2 } }
      break
    case 'big_spenders':
      segmentFilter = { totalSpentCents: { gte: BIG_SPENDER_CENTS } }
      break
    case 'dormant':
      segmentFilter = {
        lastOrderAt: { not: null, lt: dormantCutoff },
      }
      break
    case 'pickup_only':
      segmentFilter = {
        orderCount: { gt: 0 },
        orders: {
          none: { fulfillment: 'SHIP' },
        },
      }
      break
    case 'has_shipped':
      segmentFilter = {
        orders: {
          some: { fulfillment: 'SHIP' },
        },
      }
      break
    case 'new':
      segmentFilter = {
        firstOrderAt: { not: null, gte: newCutoff },
        orderCount: 1,
      }
      break
    case 'all':
    default:
      segmentFilter = {}
  }

  return searchFilter ? { AND: [searchFilter, segmentFilter] } : segmentFilter
}
