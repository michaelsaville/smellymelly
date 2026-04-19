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
  initialBirthday: string
  initialWholesaleDiscountPct: number
  allTags: Tag[]
  appliedTagIds: string[]
  thankYouSentAt: string | null
  lastReEngagementAt: string | null
  lastBirthdayEmailYear: number | null
}

type EmailKind = 'thank_you' | 're_engagement' | 'birthday'

const EMAIL_BUTTONS: { kind: EmailKind; label: string }[] = [
  { kind: 'thank_you', label: 'Thank-you' },
  { kind: 're_engagement', label: 'Re-engagement' },
  { kind: 'birthday', label: 'Birthday' },
]

function prettyDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString()
}

export default function CustomerEditor({
  customerId,
  initialNotes,
  initialBirthday,
  initialWholesaleDiscountPct,
  allTags,
  appliedTagIds,
  thankYouSentAt,
  lastReEngagementAt,
  lastBirthdayEmailYear,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Tags
  const [applied, setApplied] = useState<Set<string>>(new Set(appliedTagIds))
  const [newTagName, setNewTagName] = useState('')

  // Notes
  const [notes, setNotes] = useState(initialNotes)
  const [savedNotes, setSavedNotes] = useState(initialNotes)
  const [noteStatus, setNoteStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const notesDirty = notes !== savedNotes

  // Phase 7 fields
  const [birthday, setBirthday] = useState(initialBirthday)
  const [savedBirthday, setSavedBirthday] = useState(initialBirthday)
  const [wholesale, setWholesale] = useState(String(initialWholesaleDiscountPct))
  const [savedWholesale, setSavedWholesale] = useState(initialWholesaleDiscountPct)
  const [fieldsStatus, setFieldsStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const fieldsDirty =
    birthday !== savedBirthday || Number(wholesale) !== savedWholesale

  const [error, setError] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<EmailKind | null>(null)
  const [emailSent, setEmailSent] = useState<string | null>(null)

  async function patch(data: Record<string, unknown>) {
    const res = await fetch(`/api/admin/customers/${customerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Save failed')
    return json
  }

  async function saveNotes() {
    setNoteStatus('saving')
    setError(null)
    try {
      await patch({ notes })
      setSavedNotes(notes)
      setNoteStatus('saved')
      setTimeout(() => setNoteStatus('idle'), 1500)
    } catch (err) {
      setNoteStatus('error')
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function saveFields() {
    const pct = Number(wholesale)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError('Wholesale % must be between 0 and 100')
      return
    }
    setFieldsStatus('saving')
    setError(null)
    try {
      await patch({
        birthday: birthday || null,
        wholesaleDiscountPct: pct,
      })
      setSavedBirthday(birthday)
      setSavedWholesale(pct)
      setFieldsStatus('saved')
      setTimeout(() => setFieldsStatus('idle'), 1500)
      startTransition(() => router.refresh())
    } catch (err) {
      setFieldsStatus('error')
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
      await toggleTag(data.tag.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tag create failed')
    }
  }

  async function sendEmail(kind: EmailKind) {
    if (
      !confirm(
        `Send ${kind.replace('_', ' ')} email to this customer now? This cannot be undone.`,
      )
    ) {
      return
    }
    setSendingEmail(kind)
    setError(null)
    setEmailSent(null)
    try {
      const res = await fetch(
        `/api/admin/customers/${customerId}/send-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind }),
        },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setEmailSent(kind.replace('_', ' '))
      startTransition(() => router.refresh())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSendingEmail(null)
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
          Profile
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">
              Birthday
            </label>
            <input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">
              Wholesale discount (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={wholesale}
              onChange={(e) => setWholesale(e.target.value)}
              className="input"
            />
            <p className="mt-1 text-xs text-brand-brown/50">
              Applied to the subtotal on every future order this customer
              places (0 disables).
            </p>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-brand-warm/40">
            <span className="text-xs text-brand-brown/50">
              {fieldsStatus === 'saving' && 'Saving…'}
              {fieldsStatus === 'saved' && 'Saved'}
              {fieldsStatus === 'error' && 'Save failed'}
              {fieldsStatus === 'idle' &&
                (fieldsDirty ? 'Unsaved changes' : 'Saved')}
            </span>
            <button
              type="button"
              onClick={saveFields}
              disabled={!fieldsDirty || fieldsStatus === 'saving'}
              className="btn-primary disabled:opacity-50"
            >
              Save profile
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
          Send email
        </h2>
        <p className="text-xs text-brand-brown/60 mb-3">
          Send a one-off email to this customer. Each also records the send
          timestamp so they won't double up on the next broadcast.
        </p>
        {emailSent && (
          <div className="mb-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
            Sent: {emailSent}.
          </div>
        )}
        <div className="space-y-2">
          {EMAIL_BUTTONS.map((b) => {
            const last =
              b.kind === 'thank_you'
                ? prettyDate(thankYouSentAt)
                : b.kind === 're_engagement'
                  ? prettyDate(lastReEngagementAt)
                  : lastBirthdayEmailYear
                    ? String(lastBirthdayEmailYear)
                    : null
            return (
              <div
                key={b.kind}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm text-brand-dark">{b.label}</div>
                  <div className="text-xs text-brand-brown/50">
                    {last ? `Last sent: ${last}` : 'Never sent'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => sendEmail(b.kind)}
                  disabled={sendingEmail !== null}
                  className="btn-ghost text-xs disabled:opacity-50"
                >
                  {sendingEmail === b.kind ? 'Sending…' : 'Send now'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
          Notes
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Private notes — favorite scents, allergies, anything worth remembering…"
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
