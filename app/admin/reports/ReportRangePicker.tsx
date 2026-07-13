'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RANGE_OPTIONS, type OrderFilters } from '@/app/lib/order-views'

export default function ReportRangePicker({ range, from, to }: OrderFilters) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function go(next: { range?: string; from?: string; to?: string }) {
    const p = new URLSearchParams()
    if (next.range && next.range !== 'all') p.set('range', next.range)
    if (next.from) p.set('from', next.from)
    if (next.to) p.set('to', next.to)
    const qs = p.toString()
    startTransition(() => router.push(qs ? `/admin/reports?${qs}` : '/admin/reports'))
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? 'opacity-70' : ''}`}>
      <select
        value={range ?? 'month'}
        onChange={(e) => go({ range: e.target.value, from, to })}
        className="input"
      >
        {RANGE_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        <option value="all">All time</option>
      </select>
      {range === 'custom' && (
        <>
          <input type="date" value={from ?? ''} onChange={(e) => go({ range: 'custom', from: e.target.value, to })} className="input" />
          <input type="date" value={to ?? ''} onChange={(e) => go({ range: 'custom', from, to: e.target.value })} className="input" />
        </>
      )}
    </div>
  )
}
