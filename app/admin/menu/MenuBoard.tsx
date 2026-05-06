'use client'

import { useMemo, useState } from 'react'

type Scent = { id: string; name: string; isActive?: boolean }
type Group = {
  id: string
  name: string
  displayLabel: string | null
  priceLabel: string | null
  theme: string
  sortOrder: number
  isActive: boolean
  scents: Scent[]
}

const THEMES: { key: string; label: string; swatch: string }[] = [
  { key: 'scrub', label: 'Berry', swatch: '#3d1124' },
  { key: 'butter', label: 'Plum', swatch: '#251040' },
  { key: 'beard', label: 'Amber', swatch: '#2e1f00' },
  { key: 'lip', label: 'Mint', swatch: '#002e28' },
  { key: 'scrub2', label: 'Rose', swatch: '#2e0a18' },
]

// HTML5 dataTransfer payload.
type DragPayload =
  | { kind: 'palette'; scentId: string }
  | { kind: 'group'; scentId: string; groupId: string }

export function MenuBoard({
  initialGroups,
  initialScents,
}: {
  initialGroups: Group[]
  initialScents: Scent[]
}) {
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [scents, setScents] = useState<Scent[]>(initialScents)
  const [dragOver, setDragOver] = useState<string | null>(null) // groupId or 'palette'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map scentId -> [groupName] so palette pills can show "in: X, Y".
  const scentInGroups = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const g of groups) {
      for (const s of g.scents) {
        const arr = map.get(s.id) ?? []
        arr.push(g.name)
        map.set(s.id, arr)
      }
    }
    return map
  }, [groups])

  async function persistGroupScents(groupId: string, scentIds: string[]) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/menu/groups/scents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, scentIds }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function handleDragStart(e: React.DragEvent, payload: DragPayload) {
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  async function handleDropOnGroup(e: React.DragEvent, targetGroupId: string) {
    e.preventDefault()
    setDragOver(null)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    const payload = JSON.parse(raw) as DragPayload

    const target = groups.find((g) => g.id === targetGroupId)
    if (!target) return

    if (payload.kind === 'palette') {
      // Add to target if not already present (append at end).
      if (target.scents.some((s) => s.id === payload.scentId)) return
      const scent = scents.find((s) => s.id === payload.scentId)
      if (!scent) return
      const nextScents = [...target.scents, { id: scent.id, name: scent.name }]
      updateGroupScents(targetGroupId, nextScents)
      await persistGroupScents(
        targetGroupId,
        nextScents.map((s) => s.id),
      )
    } else if (payload.kind === 'group') {
      if (payload.groupId === targetGroupId) return // same column = noop, reorder uses arrows
      // Move: remove from source, add to target (if not already).
      const source = groups.find((g) => g.id === payload.groupId)
      if (!source) return
      const moving = source.scents.find((s) => s.id === payload.scentId)
      if (!moving) return
      const newSource = source.scents.filter((s) => s.id !== payload.scentId)
      const newTarget = target.scents.some((s) => s.id === payload.scentId)
        ? target.scents
        : [...target.scents, moving]
      updateGroupScents(source.id, newSource)
      updateGroupScents(target.id, newTarget)
      await Promise.all([
        persistGroupScents(
          source.id,
          newSource.map((s) => s.id),
        ),
        persistGroupScents(
          target.id,
          newTarget.map((s) => s.id),
        ),
      ])
    }
  }

  async function handleDropOnPalette(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(null)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    const payload = JSON.parse(raw) as DragPayload
    if (payload.kind !== 'group') return // dragging from palette to palette = noop

    const source = groups.find((g) => g.id === payload.groupId)
    if (!source) return
    const newSource = source.scents.filter((s) => s.id !== payload.scentId)
    updateGroupScents(source.id, newSource)
    await persistGroupScents(
      source.id,
      newSource.map((s) => s.id),
    )
  }

  function updateGroupScents(groupId: string, nextScents: Scent[]) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, scents: nextScents } : g)),
    )
  }

  async function moveWithinGroup(
    groupId: string,
    fromIndex: number,
    direction: -1 | 1,
  ) {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const toIndex = fromIndex + direction
    if (toIndex < 0 || toIndex >= group.scents.length) return
    const next = [...group.scents]
    ;[next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]]
    updateGroupScents(groupId, next)
    await persistGroupScents(
      groupId,
      next.map((s) => s.id),
    )
  }

  async function removeFromGroup(groupId: string, scentId: string) {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const next = group.scents.filter((s) => s.id !== scentId)
    updateGroupScents(groupId, next)
    await persistGroupScents(
      groupId,
      next.map((s) => s.id),
    )
  }

  async function patchGroup(id: string, patch: Partial<Group>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/menu/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteGroup(id: string) {
    if (!confirm('Delete this card from the menu? Scents stay in your master list.')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/menu/groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Delete failed')
      setGroups((prev) => prev.filter((g) => g.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function addGroup() {
    const name = prompt('Card name (e.g. "Soaps")')
    if (!name?.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/menu/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Create failed')
      setGroups((prev) => [...prev, { ...json.data, scents: [] }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function addNewScentToMaster() {
    const name = prompt('New scent name (added to master list)')
    if (!name?.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/scents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Create failed')
      setScents((prev) =>
        [...prev, { id: json.data.id, name: json.data.name, isActive: true }].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Scent palette */}
      <div
        className={`card ${dragOver === 'palette' ? 'ring-2 ring-brand-terra' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver('palette')
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={handleDropOnPalette}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Scent palette ({scents.length})
          </h2>
          <div className="flex items-center gap-2">
            {busy && (
              <span className="text-xs text-brand-brown/50">Saving…</span>
            )}
            <button
              onClick={addNewScentToMaster}
              className="text-xs text-brand-brown/60 hover:text-brand-terra"
            >
              + New scent
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-brand-brown/50">
          Drag any scent into a card below. Drag a card pill back here to remove it from that card.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {scents.map((scent) => {
            const inGroups = scentInGroups.get(scent.id) ?? []
            return (
              <button
                key={scent.id}
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, { kind: 'palette', scentId: scent.id })
                }
                title={
                  inGroups.length
                    ? `On the menu in: ${inGroups.join(', ')}`
                    : 'Not on the menu yet'
                }
                className={`cursor-grab rounded-full border px-2.5 py-1 text-xs transition-colors active:cursor-grabbing ${
                  inGroups.length
                    ? 'border-brand-warm bg-brand-warm/40 text-brand-dark'
                    : 'border-dashed border-brand-warm bg-white text-brand-brown/70 hover:border-brand-terra hover:text-brand-terra'
                }`}
              >
                {scent.name}
                {inGroups.length > 0 && (
                  <span className="ml-1 text-[10px] opacity-60">
                    ·{inGroups.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Group columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
        {groups.map((group) => (
          <GroupColumn
            key={group.id}
            group={group}
            isDragOver={dragOver === group.id}
            onDragEnter={() => setDragOver(group.id)}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDropOnGroup(e, group.id)}
            onDragStart={handleDragStart}
            onMove={moveWithinGroup}
            onRemove={removeFromGroup}
            onPatch={patchGroup}
            onDelete={() => deleteGroup(group.id)}
          />
        ))}
        <button
          onClick={addGroup}
          className="card flex min-h-[160px] items-center justify-center border-2 border-dashed border-brand-warm/60 text-sm text-brand-brown/50 hover:border-brand-terra hover:text-brand-terra"
        >
          + Add card
        </button>
      </div>
    </div>
  )
}

function GroupColumn({
  group,
  isDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragStart,
  onMove,
  onRemove,
  onPatch,
  onDelete,
}: {
  group: Group
  isDragOver: boolean
  onDragEnter: () => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onDragStart: (e: React.DragEvent, p: DragPayload) => void
  onMove: (groupId: string, fromIndex: number, direction: -1 | 1) => void
  onRemove: (groupId: string, scentId: string) => void
  onPatch: (id: string, patch: Partial<Group>) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        onDragEnter()
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`card ${isDragOver ? 'ring-2 ring-brand-terra' : ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                className="input"
                value={group.name}
                onChange={(e) => onPatch(group.id, { name: e.target.value })}
                placeholder="Internal name"
              />
              <input
                className="input"
                value={group.displayLabel ?? ''}
                onChange={(e) =>
                  onPatch(group.id, { displayLabel: e.target.value })
                }
                placeholder="Card title (e.g. Beard Balm)"
              />
              <input
                className="input"
                value={group.priceLabel ?? ''}
                onChange={(e) =>
                  onPatch(group.id, { priceLabel: e.target.value })
                }
                placeholder="Price label (e.g. 4 oz · $10)"
              />
              <div className="flex flex-wrap gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => onPatch(group.id, { theme: t.key })}
                    title={t.label}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                      group.theme === t.key
                        ? 'border-brand-terra bg-brand-warm/40 text-brand-dark'
                        : 'border-brand-warm bg-white text-brand-brown/60 hover:border-brand-terra'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="h-3 w-3 rounded-full"
                      style={{ background: t.swatch }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={onDelete}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Delete this card
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-brand-brown/60 hover:text-brand-terra"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="font-display text-base font-semibold text-brand-dark">
                {group.displayLabel || group.name}
              </div>
              <div className="text-xs text-brand-brown/60">
                {group.priceLabel || 'No price label'} ·{' '}
                {group.scents.length} scent
                {group.scents.length === 1 ? '' : 's'}
              </div>
            </div>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-brand-brown/60 hover:text-brand-terra"
          >
            Edit
          </button>
        )}
      </div>

      <div className="min-h-[60px] rounded-lg border border-dashed border-brand-warm/60 bg-surface-muted/40 p-2">
        {group.scents.length === 0 ? (
          <p className="px-1 py-2 text-xs text-brand-brown/40">
            Drag scents here from the palette above.
          </p>
        ) : (
          <ul className="space-y-1">
            {group.scents.map((scent, i) => (
              <li
                key={scent.id}
                draggable
                onDragStart={(e) =>
                  onDragStart(e, {
                    kind: 'group',
                    scentId: scent.id,
                    groupId: group.id,
                  })
                }
                className="flex cursor-grab items-center justify-between rounded-md border border-brand-warm bg-white px-2 py-1 text-xs active:cursor-grabbing"
              >
                <span className="truncate font-medium text-brand-dark">
                  {scent.name}
                </span>
                <span className="flex items-center gap-1">
                  <button
                    onClick={() => onMove(group.id, i, -1)}
                    disabled={i === 0}
                    className="text-brand-brown/50 hover:text-brand-terra disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => onMove(group.id, i, 1)}
                    disabled={i === group.scents.length - 1}
                    className="text-brand-brown/50 hover:text-brand-terra disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => onRemove(group.id, scent.id)}
                    className="text-red-400 hover:text-red-600"
                    title="Remove from card"
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
