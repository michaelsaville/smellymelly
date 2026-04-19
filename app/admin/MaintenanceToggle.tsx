'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialOn: boolean
  initialMessage: string
}

export default function MaintenanceToggle({ initialOn, initialMessage }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [on, setOn] = useState(initialOn)
  const [message, setMessage] = useState(initialMessage)
  const [savedMessage, setSavedMessage] = useState(initialMessage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messageDirty = message !== savedMessage

  async function save(next: { maintenanceMode?: boolean; maintenanceMessage?: string }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/settings/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      if (typeof data.maintenanceMode === 'boolean') setOn(data.maintenanceMode)
      if (typeof data.maintenanceMessage === 'string') {
        setMessage(data.maintenanceMessage)
        setSavedMessage(data.maintenanceMessage)
      }
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`card ${on ? 'border-amber-300 bg-amber-50' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Site Status
          </h2>
          <p className="text-sm text-brand-brown/70 mt-1">
            {on ? (
              <>
                <strong className="text-amber-700">Maintenance mode is ON.</strong>{' '}
                Public visitors see the &quot;be right back&quot; page. You
                (logged in as admin) still see the real site.
              </>
            ) : (
              <>Public site is live. Flip this on when you want to edit
              scents or products without customers seeing partial updates.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => save({ maintenanceMode: !on })}
          disabled={busy}
          className={`flex-shrink-0 rounded-full w-14 h-8 relative transition-colors ${
            on ? 'bg-amber-500' : 'bg-gray-300'
          } disabled:opacity-50`}
          aria-label="Toggle maintenance mode"
        >
          <span
            className={`absolute top-1 h-6 w-6 bg-white rounded-full shadow transition-transform ${
              on ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-brand-warm/40">
        <label className="block text-xs text-brand-brown/60 mb-1">
          Message shown to visitors (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="We're putting the finishing touches on some new scents. Back very soon — thanks for your patience!"
          rows={2}
          className="input resize-y"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-brand-brown/50">
            {messageDirty ? 'Unsaved changes' : 'Saved'}
          </span>
          <button
            type="button"
            onClick={() => save({ maintenanceMessage: message })}
            disabled={!messageDirty || busy}
            className="btn-ghost text-xs disabled:opacity-50"
          >
            Save message
          </button>
        </div>
      </div>
    </div>
  )
}
