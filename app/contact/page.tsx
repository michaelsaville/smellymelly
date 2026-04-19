'use client'

import { useState, type FormEvent } from 'react'
import StoreLayout from '@/app/components/StoreLayout'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, honeypot }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || "Couldn't send message. Please try again.")
        setSubmitting(false)
        return
      }
      setSubmitted(true)
    } catch {
      setError("Couldn't send message. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <StoreLayout>
      <div className="bg-gradient-to-b from-brand-cream to-surface-warm py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            Get in Touch
          </h1>
          <p className="mt-2 text-center text-brand-brown/60">
            Questions, custom orders, or just want to say hi?
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="card text-center py-12">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-terra/10 mb-4">
                  <svg className="h-7 w-7 text-brand-terra" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-display text-xl font-bold text-brand-dark">Message Sent!</h2>
                <p className="mt-2 text-brand-brown/60">
                  Thanks for reaching out. I&apos;ll get back to you as soon as I can.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false)
                    setName('')
                    setEmail('')
                    setMessage('')
                  }}
                  className="btn-secondary mt-6"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="card space-y-4">
                {/* Honeypot — hidden from real users, bots fill it */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                />
                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium text-brand-brown mb-1">
                    Name *
                  </label>
                  <input
                    id="contactName"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="contactEmail" className="block text-sm font-medium text-brand-brown mb-1">
                    Email *
                  </label>
                  <input
                    id="contactEmail"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="contactMessage" className="block text-sm font-medium text-brand-brown mb-1">
                    Message *
                  </label>
                  <textarea
                    id="contactMessage"
                    required
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="input resize-y"
                    placeholder="What can I help you with?"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" className="btn-primary w-full" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Business info sidebar */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card">
              <h2 className="font-display text-lg font-bold text-brand-dark mb-4">Contact Info</h2>
              <div className="space-y-4 text-sm text-brand-brown">
                <div>
                  <p className="font-medium text-brand-dark">Email</p>
                  <a href="mailto:hello@smellymelly.net" className="text-brand-terra hover:underline">
                    hello@smellymelly.net
                  </a>
                </div>
                <div>
                  <p className="font-medium text-brand-dark">Phone</p>
                  <p className="text-brand-brown/70">(304) 555-0123</p>
                </div>
                <div>
                  <p className="font-medium text-brand-dark">Location</p>
                  <p className="text-brand-brown/70">West Virginia</p>
                </div>
              </div>
            </div>

            <div className="card bg-brand-cream/50">
              <h3 className="font-display font-semibold text-brand-dark mb-2">Custom Orders</h3>
              <p className="text-sm text-brand-brown/70 leading-relaxed">
                Looking for custom scents, bulk orders for events, or personalized
                gift sets? Send me a message and let&apos;s make it happen!
              </p>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
