'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Tag {
  id: string
  name: string
  color: string
}

interface Props {
  customerId: string
  initialNotes: string
  allTags: Tag[]
  appliedTagIds: string[]
}

export default function CustomerEditor({
  customerId,
  initialNotes,
  allTags,
  appliedTagIds,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [notes, setNotes] = useState(initialNotes)
  const [savedNotes, setSavedNotes] = useState(initialNotes)
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [applied, setApplied] = useState<Set<string>>(new Set(appliedTagIds))
  const [newTagName, setNewTagName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const notesDirty = notes !== savedNotes

  async function saveNotes() {
    setNoteStatus('saving')
    setError(null)
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSavedNotes(notes)
      setNoteStatus('saved')
      setTimeout(() => setNoteStatus('idle'), 1500)
    } catch (err) {
      setNoteStatus('error')
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function toggleTag(tagId: string) {
    const next = new Set(applied)
    const wasApplied = next.has(tagId)
    if (wasApplied) next.delete(tagId)
    else next.add(tagId)
    setApplied(next)

    try {
      const res = await fetch(`/api/admin/customers/${customerId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId, action: wasApplied ? 'remove' : 'add' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Tag update failed')
      }
      startTransition(() => router.refresh())
    } catch (err) {
      // Roll back the optimistic toggle.
      const rollback = new Set(applied)
      if (wasApplied) rollback.add(tagId)
      else rollback.delete(tagId)
      setApplied(rollback)
      setError(err instanceof Error ? err.message : 'Tag update failed')
    }
  }

  async function createTag() {
    const name = newTagName.trim()
    if (!name) return
    setError(null)
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Tag create failed')
      setNewTagName('')
      // Auto-apply the newly created tag to this customer.
      await toggleTag(data.tag.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tag create failed')
    }
  }

  return (
    <>
      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
          Tags
        </h2>
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => {
            const isApplied = applied.has(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-all"
                style={{
                  backgroundColor: isApplied ? tag.color : 'transparent',
                  color: isApplied ? 'white' : tag.color,
                  border: `1px solid ${tag.color}`,
                  opacity: isApplied ? 1 : 0.65,
                }}
              >
                {tag.name}
              </button>
            )
          })}
          {allTags.length === 0 && (
            <p className="text-xs text-brand-brown/50">No tags yet.</p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-brand-warm/40">
          <label className="block text-xs text-brand-brown/60 mb-1">
            Create a new tag
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g. wholesale, VIP"
              className="input flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  createTag()
                }
              }}
            />
            <button
              type="button"
              onClick={createTag}
              disabled={!newTagName.trim()}
              className="btn-secondary disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
          Notes
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Private notes about this customer — favorite scents, allergies, anything worth remembering…"
          rows={6}
          className="input resize-y"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-brand-brown/50">
            {noteStatus === 'saving' && 'Saving…'}
            {noteStatus === 'saved' && 'Saved'}
            {noteStatus === 'error' && 'Save failed'}
            {noteStatus === 'idle' && (notesDirty ? 'Unsaved changes' : 'Saved')}
          </span>
          <button
            type="button"
            onClick={saveNotes}
            disabled={!notesDirty || noteStatus === 'saving'}
            className="btn-primary disabled:opacity-50"
          >
            Save notes
          </button>
        </div>
      </div>
    </>
  )
}
