'use client'

import { useState, type FormEvent } from 'react'
import StoreLayout from '@/app/components/StoreLayout'

export default function CustomOrdersPage() {
  const [type, setType] = useState<'CUSTOM' | 'WHOLESALE'>('CUSTOM')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [business, setBusiness] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, email, phone, business, message, honeypot }),
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

  return (
    <StoreLayout>
      <div className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">Custom & wholesale</h1>
        <p className="text-brand-brown/70 mb-6 text-sm">
          Want a custom scent, a big event order, or to stock Smelly Melly in your shop? Tell me what
          you have in mind and I&apos;ll be in touch.
        </p>

        {done ? (
          <div className="card text-center">
            <div className="text-4xl mb-2">💌</div>
            <p className="text-brand-dark font-medium">Thank you — your request is in!</p>
            <p className="text-sm text-brand-brown/70 mt-1">
              I&apos;ll reach out at {email} soon.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4">
            <div className="flex gap-2">
              {(['CUSTOM', 'WHOLESALE'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium border transition-colors ${
                    type === t
                      ? 'bg-brand-terra text-white border-brand-terra'
                      : 'bg-white text-brand-brown border-brand-warm hover:border-brand-terra'
                  }`}
                >
                  {t === 'CUSTOM' ? 'Custom order' : 'Wholesale'}
                </button>
              ))}
            </div>

            <input
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-brand-brown mb-1">Name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-brown mb-1">Email *</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-brown mb-1">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="input" />
              </div>
              {type === 'WHOLESALE' && (
                <div>
                  <label className="block text-sm font-medium text-brand-brown mb-1">Business name</label>
                  <input value={business} onChange={(e) => setBusiness(e.target.value)} className="input" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-brown mb-1">
                {type === 'WHOLESALE' ? 'Tell me about your shop & what you’d like to carry *' : 'What would you like? *'}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="input resize-y"
                placeholder={
                  type === 'WHOLESALE'
                    ? 'Store name, location, which products, rough quantities…'
                    : 'Scents, sizes, quantities, the occasion, your timeline…'
                }
                required
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? 'Sending…' : 'Send request'}
            </button>
          </form>
        )}
      </div>
    </StoreLayout>
  )
}
