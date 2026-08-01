'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { listTerminalReaders, saveTerminalReader } from '@/app/lib/actions/terminal'

type Reader = { id: string; label: string; status: string; deviceType: string }

/**
 * Picks which Stripe Terminal reader the POS charges. Deliberately separate
 * from SettingsForm: this one has to call out to Stripe, and folding a
 * network round-trip into that big all-at-once form would mean a Stripe
 * outage could block saving unrelated settings.
 */
export default function CardReaderPanel({
  readerId,
  readerLabel,
  keyedAvailable,
}: {
  readerId: string | null
  readerLabel: string | null
  /** Whether Stripe is configured, so New Sale can still take a typed card
   *  while no reader is set up. Changes what "no reader" actually means. */
  keyedAvailable: boolean
}) {
  const router = useRouter()
  const [readers, setReaders] = useState<Reader[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function find() {
    setLoading(true)
    setError(null)
    const res = await listTerminalReaders()
    setLoading(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setReaders(res.readers)
    if (res.readers.length === 0) {
      setError(
        'No readers are registered on this Stripe account yet. Register the reader from its own screen first, then look again.',
      )
    }
  }

  async function choose(r: Reader | null) {
    setSaving(true)
    setError(null)
    const res = await saveTerminalReader(r?.id ?? '', r?.label ?? '')
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    router.refresh()
  }

  return (
    <div className="card mt-6 p-4">
      <h2 className="font-display text-lg font-bold text-brand-dark">Card reader</h2>
      <p className="mt-1 text-sm text-brand-brown/60">
        Lets New Sale take chip and tap payments at markets. An iPad can&apos;t accept taps on
        its own, so the charge is sent to a Stripe reader. The reader needs its own internet
        (join it to the iPad&apos;s hotspot) but does not have to be on the same network as the
        iPad.
      </p>

      <div className="mt-3 rounded-lg border border-brand-warm/60 bg-white px-3 py-2 text-sm">
        {readerId ? (
          <>
            <span className="font-medium text-brand-dark">{readerLabel || readerId}</span>
            <span className="ml-2 text-xs text-brand-brown/50">{readerId}</span>
          </>
        ) : (
          <span className="text-brand-brown/60">
            {keyedAvailable
              ? 'No reader set up — Card at the till is typed in instead. That works, but it costs more per sale and the chargeback risk is ours, so pick a reader once one is registered.'
              : 'No reader set up — Card at the till records a hand-typed reference instead.'}
          </span>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {saved && <p className="mt-2 text-sm text-green-700">Saved.</p>}

      {readers && readers.length > 0 && (
        <ul className="mt-3 space-y-2">
          {readers.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={saving}
                onClick={() => choose(r)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50 ${
                  r.id === readerId
                    ? 'border-brand-terra bg-brand-cream'
                    : 'border-brand-warm/60 bg-white hover:border-brand-terra'
                }`}
              >
                <span>
                  <span className="font-medium text-brand-dark">{r.label}</span>
                  <span className="ml-2 text-xs text-brand-brown/50">{r.deviceType}</span>
                </span>
                <span
                  className={`text-xs ${
                    r.status === 'online' ? 'text-green-700' : 'text-brand-brown/50'
                  }`}
                >
                  {r.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={find}
          disabled={loading || saving}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          {loading ? 'Looking…' : readers ? 'Look again' : 'Find readers'}
        </button>
        {readerId && (
          <button
            type="button"
            onClick={() => choose(null)}
            disabled={saving}
            className="text-sm text-brand-brown/60 hover:text-brand-terra disabled:opacity-50"
          >
            Remove reader
          </button>
        )}
      </div>
    </div>
  )
}
