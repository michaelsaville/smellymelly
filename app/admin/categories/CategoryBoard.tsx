'use client'

import { useState } from 'react'
import { IconPicker, type IconValue } from './IconPicker'

type Category = {
  id: string
  name: string
  slug: string
  sortOrder: number
  isActive: boolean
  baseIngredients: string | null
  iconEmoji: string | null
  iconImageUrl: string | null
  productCount: number
}

export function CategoryBoard({ initial }: { initial: Category[] }) {
  const [cats, setCats] = useState<Category[]>(initial)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function persistOrder(next: Category[]) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map((c) => c.id) }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverId(overId)
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    setOverId(null)
    const sourceId = dragId ?? e.dataTransfer.getData('text/plain')
    setDragId(null)
    if (!sourceId || sourceId === targetId) return

    const sourceIdx = cats.findIndex((c) => c.id === sourceId)
    const targetIdx = cats.findIndex((c) => c.id === targetId)
    if (sourceIdx === -1 || targetIdx === -1) return

    const next = [...cats]
    const [moving] = next.splice(sourceIdx, 1)
    next.splice(targetIdx, 0, moving)
    setCats(next)
    await persistOrder(next)
  }

  async function move(idx: number, dir: -1 | 1) {
    const to = idx + dir
    if (to < 0 || to >= cats.length) return
    const next = [...cats]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    setCats(next)
    await persistOrder(next)
  }

  async function patchCategory(id: string, patch: Partial<Category>) {
    const optimistic = cats.map((c) => (c.id === id ? { ...c, ...patch } : c))
    setCats(optimistic)
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      // Refresh slug from server response in case it was de-duped.
      if (json.data) {
        setCats((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, slug: json.data.slug, name: json.data.name }
              : c,
          ),
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
      // Roll back on failure.
      setCats(cats)
    } finally {
      setBusy(false)
    }
  }

  async function deleteCategory(c: Category, reassignToId?: string) {
    if (c.productCount === 0 && !confirm(`Delete "${c.name}"?`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: c.id, reassignToId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      setCats((prev) => {
        const stripped = prev.filter((x) => x.id !== c.id)
        if (!reassignToId || c.productCount === 0) return stripped
        return stripped.map((x) =>
          x.id === reassignToId
            ? { ...x, productCount: x.productCount + c.productCount }
            : x,
        )
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function addCategory() {
    const name = prompt('New category name (e.g. "Bath & Body")')
    if (!name?.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Create failed')
      setCats((prev) => [...prev, json.data])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-brand-brown/50">
          {cats.length} categor{cats.length === 1 ? 'y' : 'ies'} ·{' '}
          {busy && <span>Saving…</span>}
        </p>
        <button
          onClick={addCategory}
          className="text-xs text-brand-brown/60 hover:text-brand-terra"
        >
          + New category
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cats.map((cat, i) => (
          <CategoryTile
            key={cat.id}
            cat={cat}
            index={i}
            total={cats.length}
            otherCats={cats.filter((c) => c.id !== cat.id)}
            isDragOver={overId === cat.id}
            isDragging={dragId === cat.id}
            onDragStart={(e) => handleDragStart(e, cat.id)}
            onDragOver={(e) => handleDragOver(e, cat.id)}
            onDragLeave={() => setOverId(null)}
            onDrop={(e) => handleDrop(e, cat.id)}
            onMoveUp={() => move(i, -1)}
            onMoveDown={() => move(i, 1)}
            onPatch={(patch) => patchCategory(cat.id, patch)}
            onDelete={(reassignToId) => deleteCategory(cat, reassignToId)}
          />
        ))}
        <button
          onClick={addCategory}
          className="card flex min-h-[160px] items-center justify-center border-2 border-dashed border-brand-warm/60 text-sm text-brand-brown/50 hover:border-brand-terra hover:text-brand-terra"
        >
          + Add category
        </button>
      </div>
    </div>
  )
}

function CategoryTile({
  cat,
  index,
  total,
  otherCats,
  isDragOver,
  isDragging,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveUp,
  onMoveDown,
  onPatch,
  onDelete,
}: {
  cat: Category
  index: number
  total: number
  otherCats: Category[]
  isDragOver: boolean
  isDragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onPatch: (patch: Partial<Category>) => void
  onDelete: (reassignToId?: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pickingIcon, setPickingIcon] = useState(false)
  const [reassignTo, setReassignTo] = useState<string>(otherCats[0]?.id ?? '')
  const [draftName, setDraftName] = useState(cat.name)
  const [draftSlug, setDraftSlug] = useState(cat.slug)
  const [draftIngredients, setDraftIngredients] = useState(
    cat.baseIngredients ?? '',
  )

  const iconValue: IconValue = {
    iconEmoji: cat.iconEmoji,
    iconImageUrl: cat.iconImageUrl,
  }
  function applyIcon(next: IconValue) {
    onPatch({ iconEmoji: next.iconEmoji, iconImageUrl: next.iconImageUrl })
  }

  function commit() {
    const patch: Partial<Category> = {}
    if (draftName.trim() && draftName.trim() !== cat.name) {
      patch.name = draftName.trim()
    }
    if (draftSlug.trim() && draftSlug.trim() !== cat.slug) {
      patch.slug = draftSlug.trim()
    }
    if (draftIngredients !== (cat.baseIngredients ?? '')) {
      patch.baseIngredients = draftIngredients
    }
    if (Object.keys(patch).length > 0) onPatch(patch)
    setEditing(false)
  }

  function cancel() {
    setDraftName(cat.name)
    setDraftSlug(cat.slug)
    setDraftIngredients(cat.baseIngredients ?? '')
    setEditing(false)
  }

  return (
    <div
      draggable={!editing && !pickingIcon}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`card relative transition-opacity ${editing || pickingIcon ? '' : 'cursor-grab active:cursor-grabbing'} ${
        isDragOver ? 'ring-2 ring-brand-terra' : ''
      } ${isDragging ? 'opacity-40' : ''} ${
        cat.isActive ? '' : 'bg-brand-warm/20'
      }`}
    >
      {confirming ? (
        <div className="space-y-3">
          <div>
            <h3 className="font-display text-base font-semibold text-brand-dark">
              Delete &ldquo;{cat.name}&rdquo;?
            </h3>
            {cat.productCount > 0 ? (
              <p className="mt-1 text-xs text-brand-brown/70">
                {cat.productCount} product
                {cat.productCount === 1 ? '' : 's'} will be moved into the
                category you pick below.
              </p>
            ) : (
              <p className="mt-1 text-xs text-brand-brown/70">
                No products attached. Safe to remove.
              </p>
            )}
          </div>

          {cat.productCount > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-brand-brown/70">
                Move {cat.productCount === 1 ? 'it' : 'them'} into
              </label>
              {otherCats.length === 0 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  No other categories exist. Create one first, then come back.
                </p>
              ) : (
                <select
                  className="input"
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                >
                  {otherCats.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {!o.isActive ? ' (hidden)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-brand-brown/60 hover:text-brand-terra"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirming(false)
                setEditing(false)
                onDelete(cat.productCount > 0 ? reassignTo : undefined)
              }}
              disabled={cat.productCount > 0 && otherCats.length === 0}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-40"
            >
              {cat.productCount > 0
                ? `Move & delete`
                : 'Delete'}
            </button>
          </div>
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-brand-brown/70">
              Icon
            </label>
            <button
              type="button"
              onClick={() => setPickingIcon((v) => !v)}
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-brand-warm bg-white text-2xl hover:border-brand-terra"
              title="Choose icon"
            >
              <IconDisplay cat={cat} size="md" />
            </button>
            {pickingIcon && (
              <IconPicker
                value={iconValue}
                onChange={applyIcon}
                onClose={() => setPickingIcon(false)}
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-brown/70">
              Name
            </label>
            <input
              className="input"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-brown/70">
              URL slug
            </label>
            <input
              className="input font-mono text-xs"
              value={draftSlug}
              onChange={(e) => setDraftSlug(e.target.value)}
              placeholder="auto from name"
            />
            <p className="mt-1 text-[10px] text-brand-brown/40">
              /shop?category=<span className="font-mono">{draftSlug || '…'}</span>
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-brown/70">
              Base ingredients (shared by every product)
            </label>
            <textarea
              className="input min-h-[60px] resize-y"
              value={draftIngredients}
              onChange={(e) => setDraftIngredients(e.target.value)}
              placeholder="e.g. Sugar, Sweet Almond Oil, Coconut Oil…"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => {
                setReassignTo(otherCats[0]?.id ?? '')
                setConfirming(true)
              }}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Delete
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={cancel}
                className="text-xs text-brand-brown/60 hover:text-brand-terra"
              >
                Cancel
              </button>
              <button onClick={commit} className="btn-primary text-xs">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPickingIcon((v) => !v)
                }}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-brand-warm bg-white text-2xl hover:border-brand-terra"
                title="Click to change icon"
              >
                <IconDisplay cat={cat} size="md" />
              </button>
              {pickingIcon && (
                <IconPicker
                  value={iconValue}
                  onChange={applyIcon}
                  onClose={() => setPickingIcon(false)}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-brand-brown/40">
                  #{index + 1}
                </span>
                <h3 className="truncate font-display text-base font-semibold text-brand-dark">
                  {cat.name}
                </h3>
                {!cat.isActive && (
                  <span className="rounded bg-brand-warm px-1.5 py-0.5 text-[10px] text-brand-brown/60">
                    Hidden
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-brand-brown/50">
                /shop?category={cat.slug}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <button
                onClick={onMoveUp}
                disabled={index === 0}
                className="text-brand-brown/50 hover:text-brand-terra disabled:opacity-30"
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={onMoveDown}
                disabled={index === total - 1}
                className="text-brand-brown/50 hover:text-brand-terra disabled:opacity-30"
                title="Move down"
              >
                ↓
              </button>
            </div>
          </div>

          <div className="text-xs text-brand-brown/60">
            {cat.productCount} product{cat.productCount === 1 ? '' : 's'}
          </div>

          {cat.baseIngredients && (
            <p className="mt-2 line-clamp-2 text-[11px] italic text-brand-brown/50">
              {cat.baseIngredients}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-brand-warm/30 pt-2">
            <button
              onClick={() => onPatch({ isActive: !cat.isActive })}
              className="text-xs text-brand-brown/60 hover:text-brand-terra"
            >
              {cat.isActive ? 'Hide from shop' : 'Show on shop'}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-brand-brown/60 hover:text-brand-terra"
            >
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function IconDisplay({
  cat,
  size,
}: {
  cat: { iconEmoji: string | null; iconImageUrl: string | null; name: string }
  size: 'sm' | 'md'
}) {
  const sizeClass = size === 'md' ? 'h-10 w-10 text-2xl' : 'h-6 w-6 text-base'
  if (cat.iconImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cat.iconImageUrl}
        alt=""
        className={`${sizeClass} rounded object-cover`}
        draggable={false}
      />
    )
  }
  if (cat.iconEmoji) {
    return <span className={sizeClass}>{cat.iconEmoji}</span>
  }
  return (
    <span
      className={`${sizeClass} flex items-center justify-center text-brand-brown/40`}
      aria-hidden
    >
      +
    </span>
  )
}
