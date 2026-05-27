'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

interface ScentRow {
  id: string
  name: string
  description: string
  onDescriptionSheet: boolean
  updatedAt: string
}

const PATCH_DEBOUNCE_MS = 300

export function ScentDescriptionsManager({
  initialScents,
}: {
  initialScents: ScentRow[]
}) {
  const [scents, setScents] = useState<ScentRow[]>(initialScents)
  const [search, setSearch] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return scents
    return scents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q),
    )
  }, [scents, search])

  const emptyCount = scents.filter((s) => !s.description.trim()).length
  const hiddenCount = scents.filter((s) => !s.onDescriptionSheet).length

  function applyRow(id: string, patch: Partial<ScentRow>) {
    setScents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  // Toggle whether a scent prints on the descriptions sheet. Optimistic;
  // reverts on failure.
  async function toggleSheet(id: string, next: boolean) {
    applyRow(id, { onDescriptionSheet: next })
    try {
      const res = await fetch(`/api/admin/scents/descriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onDescriptionSheet: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      applyRow(id, { onDescriptionSheet: !next })
    }
  }

  async function bulkGenerate(scope: 'empty' | 'all') {
    const confirmMsg =
      scope === 'all'
        ? `Re-roll AI descriptions for ALL ${scents.length} scents? Existing edits will be overwritten.`
        : `Generate AI descriptions for the ${emptyCount} empty scent(s)?`
    if (!confirm(confirmMsg)) return
    setBulkBusy(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/admin/scents/descriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      const j = await res.json()
      if (!res.ok) {
        setBulkResult(`Error: ${j.error ?? res.status}`)
        return
      }
      // Apply each generated description to local state.
      for (const g of j.generated as Array<{
        id: string
        description: string
      }>) {
        applyRow(g.id, { description: g.description })
      }
      const failed = j.failed as Array<{ name: string; error: string }>
      const ok = j.generated.length
      const fail = failed.length
      setBulkResult(
        fail === 0
          ? `Generated ${ok} description(s).`
          : `Generated ${ok}; ${fail} failed: ${failed
              .slice(0, 3)
              .map((f) => `${f.name} (${f.error})`)
              .join('; ')}${fail > 3 ? '…' : ''}`,
      )
    } catch (e) {
      setBulkResult(e instanceof Error ? e.message : 'Bulk generate failed')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
            className="input w-full max-w-sm text-sm"
          />
          <span className="whitespace-nowrap text-xs text-brand-brown/60">
            {filtered.length} of {scents.length} shown
            {emptyCount > 0 && (
              <span className="ml-2 text-brand-terra">
                ({emptyCount} empty)
              </span>
            )}
            {hiddenCount > 0 && (
              <span className="ml-2 text-brand-brown/50">
                ({hiddenCount} hidden from print)
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {emptyCount > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => bulkGenerate('empty')}
              className="rounded-md border border-brand-warm bg-white px-3 py-1.5 text-xs font-medium text-brand-dark hover:border-brand-terra disabled:opacity-50"
            >
              {bulkBusy ? 'Generating…' : `Generate ${emptyCount} empty`}
            </button>
          )}
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkGenerate('all')}
            className="rounded-md border border-brand-warm bg-white px-3 py-1.5 text-xs text-brand-brown/70 hover:border-red-400 hover:text-red-600 disabled:opacity-50"
          >
            Re-roll all
          </button>
        </div>
      </div>

      {bulkResult && (
        <div className="rounded-md border border-brand-warm bg-brand-cream/40 px-3 py-2 text-xs text-brand-dark">
          {bulkResult}
        </div>
      )}

      <section className="rounded-lg border border-brand-brown/15 bg-white">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-brown/60">
            No scents match the filter.
          </p>
        ) : (
          <div className="divide-y divide-brand-brown/10">
            {filtered.map((s) => (
              <ScentRowEditor
                key={s.id}
                row={s}
                onLocalChange={(text) => applyRow(s.id, { description: text })}
                onToggleSheet={(next) => toggleSheet(s.id, next)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ScentRowEditor({
  row,
  onLocalChange,
  onToggleSheet,
}: {
  row: ScentRow
  onLocalChange: (text: string) => void
  onToggleSheet: (next: boolean) => void
}) {
  const [text, setText] = useState(row.description)
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [regenBusy, setRegenBusy] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(row.description)

  // Keep the textarea in sync if the parent updates this row (e.g. after
  // a regenerate or a bulk fill returns).
  useEffect(() => {
    if (row.description !== text && row.description !== lastSavedRef.current) {
      setText(row.description)
      lastSavedRef.current = row.description
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.description])

  function scheduleSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void persist(next), PATCH_DEBOUNCE_MS)
  }

  async function persist(next: string) {
    if (next === lastSavedRef.current) return
    setSaveState('saving')
    setErrMsg(null)
    try {
      const res = await fetch(`/api/admin/scents/descriptions/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: next }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) throw new Error(j?.error ?? `Save failed (${res.status})`)
      lastSavedRef.current = next
      onLocalChange(next)
      setSaveState('saved')
      // Drop the "saved" indicator after a beat.
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1400)
    } catch (e) {
      setSaveState('error')
      setErrMsg(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function regenerate() {
    if (
      !confirm(
        `Regenerate the description for "${row.name}"? Current text will be overwritten.`,
      )
    ) {
      return
    }
    setRegenBusy(true)
    setErrMsg(null)
    try {
      const res = await fetch(`/api/admin/scents/descriptions/${row.id}`, {
        method: 'POST',
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error ?? `Regenerate failed (${res.status})`)
      const next = j.scent.description as string
      setText(next)
      lastSavedRef.current = next
      onLocalChange(next)
      setSaveState('saved')
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1400)
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Regenerate failed')
    } finally {
      setRegenBusy(false)
    }
  }

  return (
    <div
      className={`grid grid-cols-[180px_1fr_auto] items-start gap-3 px-4 py-3 hover:bg-brand-cream/30 ${
        row.onDescriptionSheet ? '' : 'opacity-60'
      }`}
    >
      <div className="pt-2">
        <div className="font-display text-sm font-semibold text-brand-dark">
          {row.name}
        </div>
        <label
          className="mt-1 flex cursor-pointer items-center gap-1.5 text-[11px] text-brand-brown/70"
          title="Show this scent on the printed descriptions sheet"
        >
          <input
            type="checkbox"
            checked={row.onDescriptionSheet}
            onChange={(e) => onToggleSheet(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand-terra"
          />
          {row.onDescriptionSheet ? (
            'Print'
          ) : (
            <span className="text-brand-brown/45">won&apos;t print</span>
          )}
        </label>
        <div className="mt-0.5 text-[10px] text-brand-brown/50">
          {saveState === 'saving' && 'saving…'}
          {saveState === 'saved' && (
            <span className="text-brand-terra">saved</span>
          )}
          {saveState === 'error' && errMsg && (
            <span className="text-red-600">{errMsg}</span>
          )}
          {saveState === 'idle' && !text.trim() && (
            <span className="text-brand-brown/40">no description</span>
          )}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          scheduleSave(e.target.value)
        }}
        onBlur={() => {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current)
            debounceRef.current = null
          }
          void persist(text)
        }}
        rows={3}
        className="w-full resize-y rounded-md border border-brand-brown/20 bg-white px-3 py-2 text-sm leading-snug focus:border-brand-terra focus:outline-none"
        placeholder={
          regenBusy
            ? 'Regenerating…'
            : 'Click "Regenerate" to draft an AI description, or type your own.'
        }
        disabled={regenBusy}
      />

      <button
        type="button"
        onClick={regenerate}
        disabled={regenBusy}
        className="mt-1 whitespace-nowrap rounded-md border border-brand-warm bg-white px-2.5 py-1 text-[11px] font-medium text-brand-brown/70 hover:border-brand-terra hover:text-brand-dark disabled:opacity-50"
        title={`Re-roll the AI description for ${row.name}`}
      >
        {regenBusy ? '…' : 'Regenerate'}
      </button>
    </div>
  )
}
