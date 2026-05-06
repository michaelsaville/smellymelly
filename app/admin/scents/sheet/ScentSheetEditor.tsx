'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface CategoryOption {
  id: string
  name: string
  /** Emoji char or image URL */
  icon: string
  isImage: boolean
}

interface ScentRow {
  id: string
  name: string
  categoryIds: string[]
}

/**
 * Toggleable category chip per scent. Optimistic UI: clicking flips
 * the chip immediately, then PATCHes the new full categoryId list to
 * /api/admin/scents/[id]/categories. Per-row save state so multiple
 * scents can be edited in parallel.
 */
export function ScentSheetEditor({
  scents,
  categories,
}: {
  scents: ScentRow[]
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState<ScentRow[]>(scents)
  const [filter, setFilter] = useState('')
  const [savingByScent, setSavingByScent] = useState<Record<string, boolean>>(
    {},
  )
  const [errorByScent, setErrorByScent] = useState<
    Record<string, string | null>
  >({})

  // Debounce timers — one per scent — so a flurry of toggles only
  // triggers ONE PATCH per scent at the trailing edge.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Cleanup timers on unmount.
  useEffect(() => {
    const t = timers.current
    return () => {
      Object.values(t).forEach((id) => clearTimeout(id))
    }
  }, [])

  function persist(scentId: string, categoryIds: string[]) {
    setSavingByScent((prev) => ({ ...prev, [scentId]: true }))
    setErrorByScent((prev) => ({ ...prev, [scentId]: null }))

    fetch(`/api/admin/scents/${scentId}/categories`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryIds }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          throw new Error(j?.error ?? `Save failed (${res.status})`)
        }
      })
      .catch((e) => {
        setErrorByScent((prev) => ({
          ...prev,
          [scentId]: e instanceof Error ? e.message : 'Save failed',
        }))
      })
      .finally(() => {
        setSavingByScent((prev) => ({ ...prev, [scentId]: false }))
        // Refresh server state so the print page sees the latest.
        router.refresh()
      })
  }

  function toggle(scentId: string, categoryId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== scentId) return r
        const has = r.categoryIds.includes(categoryId)
        const next = has
          ? r.categoryIds.filter((c) => c !== categoryId)
          : [...r.categoryIds, categoryId]
        // Schedule debounced PATCH (300ms trailing).
        if (timers.current[scentId]) clearTimeout(timers.current[scentId])
        timers.current[scentId] = setTimeout(() => persist(scentId, next), 300)
        return { ...r, categoryIds: next }
      }),
    )
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.name.toLowerCase().includes(q))
  }, [rows, filter])

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-brand-brown/70">
        <input
          type="search"
          placeholder="Search scents…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-brand-brown/20 px-2.5 py-1.5 text-sm focus:border-brand-terra focus:outline-none"
        />
        <span>{filtered.length} of {rows.length} shown</span>
        <span className="ml-auto text-brand-brown/60">
          Tip: click a chip to toggle. Saves automatically on a short
          delay so you can flip several without waiting.
        </span>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          You don&apos;t have any categories yet. Add at least one at{' '}
          <a className="underline" href="/admin/categories">
            /admin/categories
          </a>{' '}
          before you can mark scent availability.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-brand-brown/15 bg-white">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-brand-brown/10 bg-brand-cream/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-brand-brown/60">
            <span>Scent</span>
            <span>Categories</span>
          </div>
          {filtered.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-brand-brown/5 px-4 py-2.5 last:border-b-0 hover:bg-brand-cream/30"
            >
              <div>
                <div className="text-sm text-brand-dark">{row.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-brand-brown/50">
                  <span>
                    {row.categoryIds.length === 0
                      ? 'no categories'
                      : `${row.categoryIds.length} of ${categories.length}`}
                  </span>
                  {savingByScent[row.id] && (
                    <span className="text-brand-terra">saving…</span>
                  )}
                  {errorByScent[row.id] && (
                    <span className="text-red-600">
                      {errorByScent[row.id]}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {categories.map((cat) => {
                  const on = row.categoryIds.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggle(row.id, cat.id)}
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                        on
                          ? 'border-brand-terra bg-brand-terra/15 text-brand-dark'
                          : 'border-brand-brown/20 bg-white text-brand-brown/40 hover:border-brand-terra/60 hover:text-brand-brown/70'
                      }`}
                      title={`${cat.name} — click to ${on ? 'remove' : 'add'}`}
                    >
                      {cat.isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cat.icon}
                          alt={cat.name}
                          className="h-4 w-4 rounded-sm object-contain"
                        />
                      ) : (
                        <span className="text-base leading-none">
                          {cat.icon}
                        </span>
                      )}
                      <span className="hidden sm:inline">{cat.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
