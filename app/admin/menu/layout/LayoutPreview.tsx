'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MenuCards } from '@/app/menu/MenuCards'

// US Letter @ 96dpi: 8.5" × 11" → 816 × 1056 px.
// 0.5" margins each side → printable area shrinks by 96px each axis.
// LANDSCAPE: page 1056×816, printable 960×720.
// PORTRAIT:  page 816×1056, printable 720×960.
const PAGE_MARGIN = 48
const SCALE = 0.55

type Orientation = 'LANDSCAPE' | 'PORTRAIT'

function dims(o: Orientation) {
  return o === 'LANDSCAPE'
    ? { pageW: 1056, pageH: 816, printableW: 960, printableH: 720 }
    : { pageW: 816, pageH: 1056, printableW: 720, printableH: 960 }
}

type Group = {
  id: string
  name: string
  displayLabel: string | null
  priceLabel: string | null
  theme: string
  fullWidth: boolean
  scents: { id: string; name: string }[]
}

interface Props {
  groups: Group[]
  storeName: string
  phone?: string | null
  email?: string | null
  initialOrientation: Orientation
}

/**
 * Stable string snapshot of "what counts as edited" — order, fullWidth
 * per group, and orientation. We compare current vs initial to drive
 * the dirty/Save state.
 */
function snapshot(groups: Group[], orientation: Orientation): string {
  return (
    orientation +
    '|' +
    groups.map((g) => `${g.id}:${g.fullWidth ? 1 : 0}`).join(',')
  )
}

/**
 * Two-pane preview:
 *   - Left rail: ordered list of groups, drag handles to reorder,
 *     "wide" checkbox to toggle full-width per group.
 *   - Right pane: simulated landscape OR portrait page(s) with the
 *     live menu content rendered at print scale, paginated by
 *     vertical translateY offsets so each frame is a window into
 *     the same content stream.
 *
 * The right pane uses the authoritative printable width as the
 * MenuCards container, matching how the browser will paginate when
 * /menu/print is actually printed.
 */
export function LayoutPreview({
  groups,
  storeName,
  phone,
  email,
  initialOrientation,
}: Props) {
  const router = useRouter()

  const [workingGroups, setWorkingGroups] = useState<Group[]>(groups)
  const [orientation, setOrientation] =
    useState<Orientation>(initialOrientation)

  const [contentHeight, setContentHeight] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const {
    pageW: PAGE_W,
    pageH: PAGE_H,
    printableW: PRINTABLE_W,
    printableH: PRINTABLE_H,
  } = dims(orientation)

  const initialSnapshot = useMemo(
    () => snapshot(groups, initialOrientation),
    [groups, initialOrientation],
  )
  const currentSnapshot = snapshot(workingGroups, orientation)
  const dirty = currentSnapshot !== initialSnapshot

  const measureRef = useRef<HTMLDivElement | null>(null)

  // Re-measure whenever order, fullWidth, or orientation changes — and
  // again once webfonts settle (font swap shifts heights).
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const update = () => setContentHeight(el.scrollHeight)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    if (
      typeof document !== 'undefined' &&
      (document as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready
    ) {
      ;(document as { fonts: { ready: Promise<unknown> } }).fonts.ready
        .then(update)
        .catch(() => {})
    }
    return () => obs.disconnect()
  }, [workingGroups, orientation])

  const pageCount = Math.max(1, Math.ceil(contentHeight / PRINTABLE_H))
  const overflowOnLastPage =
    pageCount > 1
      ? contentHeight - (pageCount - 1) * PRINTABLE_H
      : contentHeight
  const slackOnLastPage = Math.max(0, PRINTABLE_H - overflowOnLastPage)

  // ── Drag / drop handlers ────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overId !== id) setOverId(id)
  }

  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    const sourceId = dragId ?? e.dataTransfer.getData('text/plain')
    setDragId(null)
    setOverId(null)
    if (!sourceId || sourceId === targetId) return
    setWorkingGroups((prev) => {
      const out = prev.filter((g) => g.id !== sourceId)
      const at = out.findIndex((g) => g.id === targetId)
      const moving = prev.find((g) => g.id === sourceId)
      if (!moving || at < 0) return prev
      out.splice(at, 0, moving)
      return out
    })
  }

  function onDragEnd() {
    setDragId(null)
    setOverId(null)
  }

  function move(id: string, dir: -1 | 1) {
    setWorkingGroups((prev) => {
      const at = prev.findIndex((g) => g.id === id)
      if (at < 0) return prev
      const next = at + dir
      if (next < 0 || next >= prev.length) return prev
      const out = [...prev]
      const [taken] = out.splice(at, 1)
      out.splice(next, 0, taken)
      return out
    })
  }

  function toggleFullWidth(id: string) {
    setWorkingGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, fullWidth: !g.fullWidth } : g)),
    )
  }

  function reset() {
    setWorkingGroups(groups)
    setOrientation(initialOrientation)
    setError(null)
    setSavedAt(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // Persist orientation first — single settings POST.
      if (orientation !== initialOrientation) {
        const r = await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ menuOrientation: orientation }),
        })
        if (!r.ok) {
          const j = await r.json().catch(() => null)
          throw new Error(j?.error ?? `Settings save failed (${r.status})`)
        }
      }
      // Then each group's order + fullWidth — sequential is fine for
      // a handful of rows and gives clear per-row error attribution.
      for (let i = 0; i < workingGroups.length; i++) {
        const g = workingGroups[i]
        const original = groups.find((og) => og.id === g.id)
        const data: {
          id: string
          sortOrder?: number
          fullWidth?: boolean
        } = { id: g.id }
        const orderChanged =
          !original || groups.findIndex((og) => og.id === g.id) !== i
        if (orderChanged) data.sortOrder = i
        if (original && original.fullWidth !== g.fullWidth)
          data.fullWidth = g.fullWidth
        if (data.sortOrder === undefined && data.fullWidth === undefined)
          continue
        const res = await fetch('/api/admin/menu/groups', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => null)
          throw new Error(j?.error ?? `Save failed (${res.status})`)
        }
      }
      setSavedAt(new Date())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="layout-preview-root">
      <header className="layout-preview-header">
        <div>
          <Link href="/admin/menu" className="layout-preview-back">
            ← back to menu admin
          </Link>
          <h1>Menu layout — {orientation.toLowerCase()} preview</h1>
          <p className="layout-preview-subtitle">
            Drag groups in the rail to reorder, check &quot;wide&quot; to
            make a card span the full page width, and flip orientation
            to compare landscape vs portrait. Save when the breaks land
            where you want — both the on-screen preview and the actual
            printed handout will use these choices.
          </p>
        </div>

        <div className="layout-preview-meta">
          <div className="layout-preview-orientation">
            <button
              type="button"
              className={orientation === 'LANDSCAPE' ? 'active' : ''}
              onClick={() => setOrientation('LANDSCAPE')}
              title="Landscape (wide)"
            >
              ▭ Landscape
            </button>
            <button
              type="button"
              className={orientation === 'PORTRAIT' ? 'active' : ''}
              onClick={() => setOrientation('PORTRAIT')}
              title="Portrait (tall)"
            >
              ▯ Portrait
            </button>
          </div>

          <div className="layout-preview-pagecount">
            <span className="big">{pageCount}</span>
            <span className="label">
              {pageCount === 1 ? 'page' : 'pages'}
            </span>
          </div>
          {pageCount > 0 && (
            <div className="layout-preview-slack">
              {slackOnLastPage < 80 ? (
                <span title="Last page is nearly full — even one more group risks pushing to a new page.">
                  ⚠ tight fit
                </span>
              ) : slackOnLastPage > PRINTABLE_H * 0.5 ? (
                <span title="Last page is more than half empty — could fold or rearrange to fewer pages.">
                  half empty
                </span>
              ) : (
                <span>good fit</span>
              )}
            </div>
          )}
          <div className="layout-preview-actions">
            <button
              type="button"
              onClick={reset}
              disabled={!dirty || saving}
              className="btn-ghost"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="btn-primary"
            >
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
            <a
              href="/menu/print"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              Open print page →
            </a>
          </div>
          {error && <div className="layout-preview-error">{error}</div>}
          {savedAt && !error && (
            <div className="layout-preview-saved">
              Saved at {savedAt.toLocaleTimeString()}
            </div>
          )}
        </div>
      </header>

      <div className="layout-preview-grid">
        {/* ── LEFT: drag rail + per-card width toggles ─────────── */}
        <aside className="layout-preview-rail">
          <div className="layout-preview-rail-title">
            Group order ({workingGroups.length})
          </div>
          {workingGroups.map((g, idx) => (
            <div
              key={g.id}
              draggable
              onDragStart={(e) => onDragStart(e, g.id)}
              onDragOver={(e) => onDragOver(e, g.id)}
              onDrop={(e) => onDrop(e, g.id)}
              onDragEnd={onDragEnd}
              className={`layout-preview-rail-item${
                dragId === g.id ? ' dragging' : ''
              }${overId === g.id && dragId !== g.id ? ' over' : ''}`}
            >
              <span className="grip" aria-hidden>
                ⋮⋮
              </span>
              <div className="rail-text">
                <div className="rail-name">
                  {g.displayLabel || g.name}
                </div>
                <div className="rail-meta">
                  {g.scents.length} scent{g.scents.length === 1 ? '' : 's'}
                  {g.priceLabel ? ` · ${g.priceLabel}` : ''}
                </div>
                <label className="rail-fullwidth">
                  <input
                    type="checkbox"
                    checked={g.fullWidth}
                    onChange={() => toggleFullWidth(g.id)}
                  />
                  <span>full width</span>
                </label>
              </div>
              <div className="rail-arrows">
                <button
                  type="button"
                  onClick={() => move(g.id, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(g.id, 1)}
                  disabled={idx === workingGroups.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </aside>

        {/* ── RIGHT: simulated print preview ───────────────────── */}
        <div className="layout-preview-stage">
          <div
            className="layout-preview-stage-inner"
            style={{ width: PAGE_W * SCALE }}
          >
            {/* N page frames stacked vertically. Each frame is a
                window into the same MenuCards content offset by
                pageIdx * PRINTABLE_H so what Mel sees matches the
                browser's paginated print output. */}
            {Array.from({ length: pageCount }).map((_, pageIdx) => (
              <div
                key={pageIdx}
                className="page-frame"
                style={{
                  width: PAGE_W * SCALE,
                  height: PAGE_H * SCALE,
                }}
              >
                <div
                  className="page-frame-inner"
                  style={{
                    width: PAGE_W,
                    height: PAGE_H,
                    transform: `scale(${SCALE})`,
                  }}
                >
                  <div
                    className="page-frame-content"
                    style={{ padding: PAGE_MARGIN }}
                  >
                    <div
                      style={{
                        width: PRINTABLE_W,
                        height: PRINTABLE_H,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <div
                        style={{
                          transform: `translateY(-${pageIdx * PRINTABLE_H}px)`,
                        }}
                      >
                        <MenuCards
                          groups={workingGroups}
                          storeName={storeName}
                          phone={phone}
                          email={email}
                          social="@SmellyMellys"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="page-frame-label">
                  Page {pageIdx + 1} of {pageCount}
                </div>
              </div>
            ))}
          </div>

          {/* Authoritative measure block — kept off-screen but laid
              out at the printable width so MenuCards behaves exactly
              as it will at print time. ResizeObserver tracks the
              real scrollHeight. */}
          <div
            ref={measureRef}
            className="layout-preview-measure"
            aria-hidden
            style={{ width: PRINTABLE_W }}
          >
            <MenuCards
              groups={workingGroups}
              storeName={storeName}
              phone={phone}
              email={email}
              social="@SmellyMellys"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
