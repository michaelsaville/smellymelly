// Shared (client + server safe — no prisma, no server-only imports) helpers for
// the admin Orders screen: filter shape, URL <-> filter parsing, the Prisma
// `where` builder, date-range resolution in the business timezone, and the
// seeded system views. Keep this framework-agnostic so both the server page and
// the client filter bar import the exact same logic.

export type DateRangePreset = 'today' | '7d' | '30d' | 'month' | 'custom' | 'all'

export type OrderFilters = {
  status?: string[]
  fulfillment?: string[]
  payment?: string[] // 'STRIPE_CARD' | 'MANUAL' | 'SQUARE' (SQUARE = legacy card/cashapp)
  campaign?: 'storefront' | 'campaign'
  q?: string
  range?: DateRangePreset
  from?: string // YYYY-MM-DD (custom range)
  to?: string // YYYY-MM-DD (custom range)
  dateField?: 'createdAt' | 'paidAt'
}

// ── Option lists (drive the filter UI + chip labels) ─────────────────────

export const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'PICKED_UP', label: 'Picked Up' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
] as const

export const FULFILLMENT_OPTIONS = [
  { value: 'SHIP', label: 'Ship' },
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'HOST_DELIVERY', label: 'Host Delivery' },
] as const

export const PAYMENT_OPTIONS = [
  { value: 'STRIPE_CARD', label: 'Card' },
  { value: 'MANUAL', label: 'Manual (Venmo/Cash App)' },
  { value: 'SQUARE', label: 'Square (legacy)' },
] as const

export const RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom…' },
] as const

const RANGE_VALUES = RANGE_OPTIONS.map((r) => r.value) as string[]

// Statuses that count as realized revenue in the summary (excludes PENDING /
// CANCELLED / REFUNDED so the money number stays honest).
export const REVENUE_STATUSES = [
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'PICKED_UP',
]

function labelFor(
  options: readonly { value: string; label: string }[],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value
}

// ── Business-timezone date handling ──────────────────────────────────────
// Server runs in UTC; the shop is Eastern (Cumberland, MD). Without this a
// "today" summary rolls over at 8 PM local.

const BUSINESS_TZ = 'America/New_York'

function tzOffsetMs(instant: Date, tz: string): number {
  const utc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }))
  const local = new Date(instant.toLocaleString('en-US', { timeZone: tz }))
  return local.getTime() - utc.getTime()
}

// UTC instant of a YYYY-MM-DD's local midnight (or end-of-day) in BUSINESS_TZ.
function dayBoundaryUtc(ymd: string, endOfDay: boolean): Date {
  const base = new Date(`${ymd}T00:00:00Z`)
  const startUtc = base.getTime() - tzOffsetMs(base, BUSINESS_TZ)
  return new Date(endOfDay ? startUtc + 86_400_000 - 1 : startUtc)
}

function todayYmd(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function resolveDateRange(
  filters: OrderFilters,
  now: Date = new Date(),
): { gte?: Date; lte?: Date } {
  const startOfToday = () => dayBoundaryUtc(todayYmd(now), false)
  switch (filters.range) {
    case 'today':
      return { gte: startOfToday() }
    case '7d':
      return { gte: new Date(startOfToday().getTime() - 6 * 86_400_000) }
    case '30d':
      return { gte: new Date(startOfToday().getTime() - 29 * 86_400_000) }
    case 'month':
      return { gte: dayBoundaryUtc(todayYmd(now).slice(0, 8) + '01', false) }
    case 'custom': {
      const r: { gte?: Date; lte?: Date } = {}
      if (filters.from) r.gte = dayBoundaryUtc(filters.from, false)
      if (filters.to) r.lte = dayBoundaryUtc(filters.to, true)
      return r
    }
    default:
      return {}
  }
}

// Human label for the summary bar ("Showing: …").
export function describeRange(filters: OrderFilters, now: Date = new Date()): string {
  switch (filters.range) {
    case 'today':
      return 'Today'
    case '7d':
      return 'Last 7 days'
    case '30d':
      return 'Last 30 days'
    case 'month':
      return 'This month'
    case 'custom': {
      if (filters.from && filters.to) return `${filters.from} → ${filters.to}`
      if (filters.from) return `Since ${filters.from}`
      if (filters.to) return `Through ${filters.to}`
      return 'Custom range'
    }
    default:
      return 'All orders'
  }
}

// ── Prisma where builder (plain object; cast to Prisma type at call site) ─

export function buildWhere(filters: OrderFilters): Record<string, unknown> {
  const and: Record<string, unknown>[] = []

  if (filters.status?.length) and.push({ status: { in: filters.status } })
  if (filters.fulfillment?.length) and.push({ fulfillment: { in: filters.fulfillment } })
  if (filters.payment?.length) {
    and.push({
      OR: filters.payment.map((p) =>
        p === 'SQUARE'
          ? { paymentMethod: { in: ['SQUARE_CARD', 'SQUARE_CASH_APP'] } }
          : { paymentMethod: p },
      ),
    })
  }
  if (filters.campaign === 'storefront') and.push({ campaignId: null })
  else if (filters.campaign === 'campaign') and.push({ campaignId: { not: null } })

  if (filters.q?.trim()) {
    const q = filters.q.trim()
    const or: Record<string, unknown>[] = [
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerEmail: { contains: q, mode: 'insensitive' } },
      { customerPhone: { contains: q, mode: 'insensitive' } },
    ]
    const num = parseInt(q.replace(/^#/, ''), 10)
    if (!Number.isNaN(num)) or.push({ orderNumber: num })
    and.push({ OR: or })
  }

  const dr = resolveDateRange(filters)
  if (dr.gte || dr.lte) {
    const field = filters.dateField ?? 'createdAt'
    and.push({
      [field]: {
        ...(dr.gte ? { gte: dr.gte } : {}),
        ...(dr.lte ? { lte: dr.lte } : {}),
      },
    })
  }

  return and.length ? { AND: and } : {}
}

// ── URL <-> filters ──────────────────────────────────────────────────────

export function filtersToParams(filters: OrderFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.status?.length) p.set('status', filters.status.join(','))
  if (filters.fulfillment?.length) p.set('fulfillment', filters.fulfillment.join(','))
  if (filters.payment?.length) p.set('payment', filters.payment.join(','))
  if (filters.campaign) p.set('campaign', filters.campaign)
  if (filters.q?.trim()) p.set('q', filters.q.trim())
  if (filters.range && filters.range !== 'all') p.set('range', filters.range)
  if (filters.from) p.set('from', filters.from)
  if (filters.to) p.set('to', filters.to)
  if (filters.dateField && filters.dateField !== 'createdAt') p.set('dateField', filters.dateField)
  return p
}

export function parseFilters(get: (key: string) => string | null | undefined): OrderFilters {
  const list = (k: string): string[] | undefined => {
    const v = get(k)
    const arr = v ? String(v).split(',').filter(Boolean) : []
    return arr.length ? arr : undefined
  }
  const f: OrderFilters = {}
  const status = list('status')
  if (status) f.status = status
  const fulfillment = list('fulfillment')
  if (fulfillment) f.fulfillment = fulfillment
  const payment = list('payment')
  if (payment) f.payment = payment
  const campaign = get('campaign')
  if (campaign === 'storefront' || campaign === 'campaign') f.campaign = campaign
  const q = get('q')
  if (q) f.q = String(q)
  const range = get('range')
  if (range && RANGE_VALUES.includes(String(range))) f.range = String(range) as DateRangePreset
  const from = get('from')
  if (from) f.from = String(from)
  const to = get('to')
  if (to) f.to = String(to)
  if (get('dateField') === 'paidAt') f.dateField = 'paidAt'
  return f
}

// Active-filter chips for the bar. Each chip clears its whole dimension.
export type FilterChip = { key: keyof OrderFilters | 'date'; label: string }

export function describeActiveFilters(filters: OrderFilters): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.status?.length) {
    chips.push({ key: 'status', label: `Status: ${filters.status.map((s) => labelFor(STATUS_OPTIONS, s)).join(', ')}` })
  }
  if (filters.fulfillment?.length) {
    chips.push({ key: 'fulfillment', label: `Type: ${filters.fulfillment.map((s) => labelFor(FULFILLMENT_OPTIONS, s)).join(', ')}` })
  }
  if (filters.payment?.length) {
    chips.push({ key: 'payment', label: `Payment: ${filters.payment.map((s) => labelFor(PAYMENT_OPTIONS, s)).join(', ')}` })
  }
  if (filters.campaign) {
    chips.push({ key: 'campaign', label: `Source: ${filters.campaign === 'campaign' ? 'Fundraiser' : 'Storefront'}` })
  }
  if (filters.q?.trim()) {
    chips.push({ key: 'q', label: `Search: "${filters.q.trim()}"` })
  }
  if (filters.range && filters.range !== 'all') {
    const field = filters.dateField === 'paidAt' ? 'Paid' : 'Created'
    chips.push({ key: 'date', label: `${field}: ${describeRange(filters)}` })
  }
  return chips
}

export function hasActiveFilters(filters: OrderFilters): boolean {
  return describeActiveFilters(filters).length > 0
}

// ── Seeded system views ──────────────────────────────────────────────────

export type SystemView = {
  name: string
  icon: string
  filters: OrderFilters
  displayOrder: number
}

export const SYSTEM_VIEWS: SystemView[] = [
  { name: 'All Orders', icon: '📋', filters: {}, displayOrder: 0 },
  { name: 'Needs Fulfillment', icon: '📦', filters: { status: ['PAID', 'PROCESSING'] }, displayOrder: 10 },
  { name: 'Awaiting Payment', icon: '💰', filters: { status: ['PENDING'] }, displayOrder: 20 },
  { name: 'Ready for Pickup', icon: '🛍️', filters: { status: ['READY_FOR_PICKUP'] }, displayOrder: 30 },
  { name: 'Ship Today', icon: '🚚', filters: { fulfillment: ['SHIP'], status: ['PAID', 'PROCESSING'] }, displayOrder: 40 },
  { name: 'Today', icon: '📅', filters: { range: 'today' }, displayOrder: 50 },
]

// True when a saved view's stored filters equal the currently active ones —
// used to highlight the matching view pill.
export function filtersEqual(a: OrderFilters, b: OrderFilters): boolean {
  return filtersToParams(a).toString() === filtersToParams(b).toString()
}
