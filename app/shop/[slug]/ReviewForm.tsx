'use client'

import { useState, type FormEvent } from 'react'

export default function ReviewForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false)
  const [authorName, setAuthorName] = useState('')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, authorName, rating, title: title || undefined, body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
        Thank you! Your review will appear once it&apos;s approved. 💛
      </div>
    )
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary text-sm">
        Write a review
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-brand-warm/60 p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-brand-brown mb-1">Your rating</label>
        <div className="flex gap-1 text-2xl" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              className={`${i <= (hover || rating) ? 'text-amber-500' : 'text-brand-warm/50'} leading-none`}
              aria-label={`${i} star${i > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name"
          className="input"
          required
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="input"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you think?"
        rows={3}
        className="input resize-y"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary text-sm disabled:opacity-60">
          {busy ? 'Submitting…' : 'Submit review'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-brand-brown/60 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  )
}
