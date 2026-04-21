'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePageText, resetPageText } from '@/app/lib/actions/page-text'

interface Props {
  fieldKey: string
  label: string
  kind: 'short' | 'long' | 'list'
  hint?: string
  initialValue: string
  fallback: string
  isOverridden: boolean
}

export function CopyEditor({
  fieldKey,
  label,
  kind,
  hint,
  initialValue,
  fallback,
  isOverridden: initialOverridden,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)
  const [overridden, setOverridden] = useState(initialOverridden)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dirty = value !== initialValue
  const rows = kind === 'short' ? 1 : kind === 'list' ? 7 : 5

  function save() {
    setErr(null)
    startTransition(async () => {
      const res = await savePageText(fieldKey, value)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setSavedAt(Date.now())
      setOverridden(value !== fallback && value.trim() !== '')
      router.refresh()
    })
  }

  function reset() {
    setErr(null)
    startTransition(async () => {
      const res = await resetPageText(fieldKey)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      setValue(fallback)
      setOverridden(false)
      setSavedAt(Date.now())
      router.refresh()
    })
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <label className="font-medium text-brand-dark">{label}</label>
        <div className="flex items-center gap-2 text-xs text-brand-brown/60">
          <span className="font-mono">{fieldKey}</span>
          {overridden && (
            <span className="rounded-full bg-brand-terra/20 px-2 py-0.5 text-[10px] font-medium text-brand-terra">
              edited
            </span>
          )}
        </div>
      </div>

      {hint && <p className="text-xs text-brand-brown/60">{hint}</p>}

      {kind === 'short' ? (
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={rows}
          className="input font-normal"
        />
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-brand-brown/60">
          {savedAt && !dirty && <span className="text-green-700">Saved ✓</span>}
          {err && <span className="text-red-700">{err}</span>}
        </div>
        <div className="flex items-center gap-2">
          {overridden && (
            <button
              type="button"
              onClick={reset}
              disabled={isPending}
              className="text-xs text-brand-brown/60 hover:text-brand-terra"
            >
              reset to original
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={isPending || !dirty}
            className="btn-secondary text-sm disabled:opacity-40"
          >
            {isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>
    </div>
  )
}
