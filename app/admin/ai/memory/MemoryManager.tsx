'use client'

import { useMemo, useState } from 'react'

type Sample = {
  id: string
  content: string
  createdAt: string
}

const STALE_AGE_DAYS = 90

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function MemoryManager({ initial }: { initial: Sample[] }) {
  const [samples, setSamples] = useState<Sample[]>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [snapshotBusy, setSnapshotBusy] = useState(false)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)

  const stats = useMemo(() => {
    if (samples.length === 0) return null
    // samples come from the page newest-first
    const newest = samples[0]
    const oldest = samples[samples.length - 1]
    return {
      count: samples.length,
      newestDays: daysAgo(newest.createdAt),
      oldestDays: daysAgo(oldest.createdAt),
    }
  }, [samples])

  const isStale =
    stats !== null &&
    (stats.oldestDays > STALE_AGE_DAYS || stats.count >= 30)

  async function purgeAll() {
    if (
      !confirm(
        `Wipe all ${samples.length} stored sample${samples.length === 1 ? '' : 's'}? The bot still works, it just starts learning from scratch.`,
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ai/memory', { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Purge failed')
      setSamples([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purge failed')
    } finally {
      setBusy(false)
    }
  }

  async function generateSnapshot() {
    setSnapshotBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ai/memory/snapshot', {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Snapshot failed')
      setSnapshot(json.summary)
      setSnapshotAt(json.generatedAt ?? new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Snapshot failed')
    } finally {
      setSnapshotBusy(false)
    }
  }

  async function deleteOne(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ai/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      setSamples((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 max-w-2xl space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {stats && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs ${
            isStale
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-brand-warm/60 bg-white text-brand-brown/70'
          }`}
        >
          <div>
            <span className="font-semibold">{stats.count}</span> sample
            {stats.count === 1 ? '' : 's'} ·{' '}
            <span>
              newest {stats.newestDays === 0 ? 'today' : `${stats.newestDays}d ago`}
            </span>
            ,{' '}
            <span>
              oldest {stats.oldestDays === 0 ? 'today' : `${stats.oldestDays}d ago`}
            </span>
            {isStale && (
              <span className="ml-2 font-semibold">
                — worth a review
              </span>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-dark">
              What has the bot picked up?
            </h2>
            <p className="mt-0.5 text-xs text-brand-brown/60">
              One-click snapshot of patterns the assistant is likely learning
              from your samples. Costs about a penny to run.
            </p>
          </div>
          <button
            onClick={generateSnapshot}
            disabled={snapshotBusy || samples.length < 3}
            className="whitespace-nowrap rounded-lg bg-brand-terra px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-terra/90 disabled:opacity-40"
          >
            {snapshotBusy ? 'Thinking…' : 'Snapshot'}
          </button>
        </div>
        {samples.length < 3 ? (
          <p className="text-xs text-brand-brown/50">
            Send the bot at least 3 messages first, then come back.
          </p>
        ) : snapshot ? (
          <div className="space-y-2 rounded-lg border border-brand-warm/60 bg-surface-muted/50 px-3 py-2.5 text-sm leading-relaxed text-brand-dark">
            {snapshot.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
            {snapshotAt && (
              <p className="pt-1 text-[10px] text-brand-brown/40">
                Generated {new Date(snapshotAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-brand-brown/40">
            No snapshot yet. Hit the button above when you want one.
          </p>
        )}
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Saved phrases ({samples.length})
          </h2>
          <button
            onClick={purgeAll}
            disabled={busy || samples.length === 0}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Wipe all'}
          </button>
        </div>

        {samples.length === 0 ? (
          <p className="text-sm text-brand-brown/50">
            Nothing stored yet. The next thing you type to the bot will land
            here.
          </p>
        ) : (
          <ul className="divide-y divide-brand-warm/40">
            {samples.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm text-brand-dark">
                    {s.content}
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand-brown/40">
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => deleteOne(s.id)}
                  disabled={busy}
                  className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  title="Forget this one"
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-xs text-brand-brown/50">
        <p>
          <span className="font-semibold">How this works:</span> the bot
          stores up to 30 of your most recent messages. The 8 newest get
          handed to it on every chat as &ldquo;Melly tends to phrase things
          like &hellip;&rdquo;. It uses them to mimic your tone &mdash; it
          does <em>not</em> repeat them back at you.
        </p>
        <p className="mt-2">
          <span className="font-semibold">Safe to wipe:</span> the bot keeps
          working with zero samples. It just falls back to its base style.
        </p>
      </div>
    </div>
  )
}
