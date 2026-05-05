'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MenuCards } from '@/app/menu/MenuCards'

// US Letter landscape @ 96dpi: 1056 × 816 px.
// 0.5" margins on each side: printable area = 960 × 720 px.
const PAGE_W = 1056
const PAGE_H = 816
const PRINTABLE_W = 960
const PRINTABLE_H = 720
const PAGE_MARGIN = 48 // 0.5" at 96dpi
const SCALE = 0.55

type Group = {
  id: string
  name: string
  displayLabel: string | null
  priceLabel: string | null
  theme: string
  scents: { id: string; name: string }[]
}

interface Props {
  groups: Group[]
  storeName: string
  phone?: string | null
  email?: string | null
}

/**
 * Two-pane preview:
 *   - Left rail: ordered list of groups, drag handles to reorder.
 *   - Right pane: simulated landscape page(s) with the live menu
 *     content rendered at print scale and dashed lines overlaid
 *     where each page break will fall when this prints.
 *
 * The right pane uses ONE flowing render of <MenuCards/> at the
 * authoritative printable width (960px). That same flow is what
 * the browser will paginate when /menu/print is actually printed,
 * so what Mel sees here is what she'll get on paper.
 */
export function LayoutPreview({ groups, storeName, phone, email }: Props) {
  const router = useRouter()

  const [order, setOrder] = useState<string[]>(() => groups.map((g) => g.id))
  const [contentHeight, setContentHeight] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const initialOrder = useMemo(() => groups.map((g) => g.id), [groups])
  const dirty = useMemo(
    () => order.join('|') !== initialOrder.join('|'),
    [order, initialOrder],
  )

  const orderedGroups = useMemo(
    () =>
      order
        .map((id) => groups.find((g) => g.id === id))
        .filter((g): g is Group => Boolean(g)),
    [order, groups],
  )

  const measureRef = useRef<HTMLDivElement | null>(null)

  // Re-measure whenever order changes or fonts settle.
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const update = () => setContentHeight(el.scrollHeight)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    // Fonts settle late — re-measure after they're ready.
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      ;(document as any).fonts.ready.then(update).catch(() => {})
    }
    return () => obs.disconnect()
  }, [order])

  const pageCount = Math.max(1, Math.ceil(contentHeight / PRINTABLE_H))
  const overflowOnLastPage =
    pageCount > 1 ? contentHeight - (pageCount - 1) * PRINTABLE_H : contentHeight
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
    setOrder((prev) => {
      const next = prev.filter((id) => id !== sourceId)
      const at = next.indexOf(targetId)
      next.splice(at, 0, sourceId)
      return next
    })
  }

  function onDragEnd() {
    setDragId(null)
    setOverId(null)
  }

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const at = prev.indexOf(id)
      if (at < 0) return prev
      const next = at + dir
      if (next < 0 || next >= prev.length) return prev
      const out = [...prev]
      const [taken] = out.splice(at, 1)
      out.splice(next, 0, taken)
      return out
    })
  }

  function reset() {
    setOrder(initialOrder)
    setError(null)
    setSavedAt(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // Sequential PATCHes — small N (a handful of groups), order
      // matters less than each row landing.
      for (let i = 0; i < order.length; i++) {
        const res = await fetch('/api/admin/menu/groups', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: order[i], sortOrder: i }),
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
          <h1>Menu layout — landscape preview</h1>
          <p className="layout-preview-subtitle">
            Drag groups in the rail to reorder. The dashed lines are page
            breaks — wherever a card spans a line, it&apos;ll split on
            the printed handout. Save when the breaks land where you want.
          </p>
        </div>

        <div className="layout-preview-meta">
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
              {saving ? 'Saving…' : dirty ? 'Save order' : 'Saved'}
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
        {/* ── LEFT: drag rail ────────────────────────────────────── */}
        <aside className="layout-preview-rail">
          <div className="layout-preview-rail-title">
            Group order ({order.length})
          </div>
          {orderedGroups.map((g, idx) => (
            <div
              key={g.id}
              draggable
              onDragStart={(e) => onDragStart(e, g.id)}
              onDragOver={(e) => onDragOver(e, g.id)}
              onDrop={(e) => onDrop(e, g.id)}
              onDragEnd={onDragEnd}
              className={`layout-preview-rail-item${dragId === g.id ? ' dragging' : ''}${overId === g.id && dragId !== g.id ? ' over' : ''}`}
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
                  disabled={idx === order.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </aside>

        {/* ── RIGHT: simulated print preview ─────────────────────── */}
        <div className="layout-preview-stage">
          <div
            className="layout-preview-stage-inner"
            style={{
              width: PAGE_W * SCALE,
            }}
          >
            {/* Render N landscape page frames stacked. Each one is a
                window into the SAME content flow at increasing
                vertical offset, so the visual matches how the browser
                will actually paginate at print time. */}
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
                    style={{
                      padding: PAGE_MARGIN,
                    }}
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
                          groups={orderedGroups}
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

          {/* Hidden authoritative measure block. Same width as
              printable area so MenuCards lays out exactly the way it
              will at print time. ResizeObserver tracks scrollHeight. */}
          <div
            ref={measureRef}
            className="layout-preview-measure"
            aria-hidden
            style={{ width: PRINTABLE_W }}
          >
            <MenuCards
              groups={orderedGroups}
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
