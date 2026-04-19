import Link from 'next/link'

interface OrderLike {
  id: string
  orderNumber: number
  status: string
  fulfillment: string
  totalCents: number
  createdAt: Date
  paidAt: Date | null
  shippedAt: Date | null
  cancelledAt: Date | null
}

interface Props {
  orders: OrderLike[]
  notes: string
  customerCreatedAt: Date
  thankYouEmailSentAt: Date | null
  lastReEngagementAt: Date | null
  lastBirthdayEmailYear: number | null
}

type Entry = {
  at: Date
  icon: string
  title: string
  subtitle?: string
  href?: string
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// Parse "[YYYY-MM-DD] <text>" lines out of the free-form notes field. Lines
// without a date prefix are skipped — they can't be placed on a timeline.
function parseDatedNotes(notes: string): Array<{ at: Date; text: string }> {
  return notes
    .split('\n')
    .map((line) => {
      const match = line.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)$/)
      if (!match) return null
      const date = new Date(`${match[1]}T12:00:00Z`)
      if (Number.isNaN(date.getTime())) return null
      return { at: date, text: match[2].trim() }
    })
    .filter((x): x is { at: Date; text: string } => x !== null)
}

function buildEntries(props: Props): Entry[] {
  const entries: Entry[] = [
    {
      at: props.customerCreatedAt,
      icon: '👋',
      title: 'Customer record created',
    },
  ]

  for (const o of props.orders) {
    const orderLabel = `Order #${String(o.orderNumber).padStart(4, '0')} — ${money(o.totalCents)}`
    entries.push({
      at: o.createdAt,
      icon: '🛍️',
      title: 'Order placed',
      subtitle: orderLabel,
      href: `/admin/orders/${o.id}`,
    })
    if (o.paidAt && o.paidAt.getTime() !== o.createdAt.getTime()) {
      entries.push({
        at: o.paidAt,
        icon: '💳',
        title: 'Order paid',
        subtitle: orderLabel,
        href: `/admin/orders/${o.id}`,
      })
    }
    if (o.shippedAt) {
      entries.push({
        at: o.shippedAt,
        icon: '📦',
        title: 'Order shipped',
        subtitle: orderLabel,
        href: `/admin/orders/${o.id}`,
      })
    }
    if (o.cancelledAt) {
      entries.push({
        at: o.cancelledAt,
        icon: '✖',
        title: 'Order cancelled',
        subtitle: orderLabel,
        href: `/admin/orders/${o.id}`,
      })
    }
  }

  for (const note of parseDatedNotes(props.notes)) {
    entries.push({
      at: note.at,
      icon: '📝',
      title: 'Note added',
      subtitle: note.text,
    })
  }

  if (props.thankYouEmailSentAt) {
    entries.push({
      at: props.thankYouEmailSentAt,
      icon: '✉',
      title: 'Thank-you email sent',
    })
  }
  if (props.lastReEngagementAt) {
    entries.push({
      at: props.lastReEngagementAt,
      icon: '💐',
      title: 'Re-engagement email sent',
    })
  }

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime())
}

export default function ActivityTimeline(props: Props) {
  const entries = buildEntries(props)

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">
        Activity
      </h2>
      <ol className="relative border-l-2 border-brand-warm/50 ml-3">
        {entries.map((e, i) => (
          <li key={i} className="pl-6 pb-4 last:pb-0 relative">
            <div className="absolute -left-[13px] top-0 h-6 w-6 rounded-full bg-brand-cream border-2 border-brand-warm flex items-center justify-center text-xs">
              {e.icon}
            </div>
            <div className="text-sm font-medium text-brand-dark">
              {e.href ? (
                <Link href={e.href} className="hover:text-brand-terra">
                  {e.title}
                </Link>
              ) : (
                e.title
              )}
            </div>
            {e.subtitle && (
              <div className="text-xs text-brand-brown/60 mt-0.5">
                {e.subtitle}
              </div>
            )}
            <div className="text-xs text-brand-brown/40 mt-0.5">
              {e.at.toLocaleDateString()} · {e.at.toLocaleTimeString()}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
