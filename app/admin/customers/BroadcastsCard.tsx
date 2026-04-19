'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const BROADCASTS = [
  {
    kind: 'thank_you' as const,
    label: 'Thank-you emails',
    help: 'Customers whose first order was 6–14 days ago and haven\'t received one yet.',
  },
  {
    kind: 're_engagement' as const,
    label: 'Re-engagement (dormant)',
    help: 'Customers with no order in 90+ days. Cooldown: one send per 90 days per customer.',
  },
  {
    kind: 'birthday' as const,
    label: 'Birthday emails',
    help: 'Customers whose birthday is today and who haven\'t received this year\'s birthday email yet.',
  },
]

type Kind = (typeof BROADCASTS)[number]['kind']

interface Result {
  kind: Kind
  eligibleCount: number
  sent?: number
  failed?: number
  eligible?: Array<{ name: string; email: string }>
  errors?: string[]
}

export default function BroadcastsCard() {
  const router = useRouter()
  const [busy, setBusy] = useState<Kind | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: Kind, dryRun: boolean) {
    setBusy(kind)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/admin/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, dryRun }),
      })
      const data = (await res.json()) as Result & { error?: string }
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setResult(data)
      if (!dryRun) router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="card mb-6">
      <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
        Broadcasts
      </h2>
      <p className="text-xs text-brand-brown/60 mb-4">
        Manual email broadcasts. Preview eligibility before sending.
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mb-4 rounded-lg bg-surface-warm border border-brand-warm/60 px-3 py-2 text-sm">
          <div className="font-medium text-brand-dark">
            {result.sent !== undefined
              ? `Sent ${result.sent} · ${result.failed} failed · ${result.eligibleCount} eligible`
              : `${result.eligibleCount} customer${result.eligibleCount === 1 ? '' : 's'} eligible for ${result.kind.replace('_', ' ')}`}
          </div>
          {result.eligible && result.eligible.length > 0 && (
            <ul className="mt-2 text-xs text-brand-brown/70 space-y-0.5 max-h-40 overflow-y-auto">
              {result.eligible.map((c) => (
                <li key={c.email}>
                  {c.name} ({c.email})
                </li>
              ))}
            </ul>
          )}
          {result.errors && result.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-700 space-y-0.5">
              {result.errors.map((e, i) => (
                <li key={i}>• {e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-3">
        {BROADCASTS.map((b) => (
          <div
            key={b.kind}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-brand-warm/40"
          >
            <div className="min-w-0">
              <div className="font-medium text-sm text-brand-dark">{b.label}</div>
              <div className="text-xs text-brand-brown/60">{b.help}</div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => run(b.kind, true)}
                disabled={busy !== null}
                className="btn-ghost text-xs disabled:opacity-50"
              >
                {busy === b.kind ? 'Working…' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Send ${b.label.toLowerCase()} to every eligible customer? This cannot be undone.`,
                    )
                  ) {
                    run(b.kind, false)
                  }
                }}
                disabled={busy !== null}
                className="btn-secondary text-xs disabled:opacity-50"
              >
                Send all
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
