'use client'

import { useState } from 'react'

export default function PayLinkBar({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  // Built client-side so it always matches the domain the admin is on.
  const url = typeof window !== 'undefined' ? `${window.location.origin}/invoice/${token}` : `/invoice/${token}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the input is selectable as a fallback.
    }
  }

  return (
    <div className="rounded-lg border border-brand-warm/60 bg-brand-cream/40 px-4 py-3 print:hidden">
      <div className="text-xs font-medium uppercase tracking-wide text-brand-brown/50 mb-1.5">
        Customer pay link
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="input flex-1 text-sm font-mono"
        />
        <div className="flex gap-2">
          <button type="button" onClick={copy} className="btn-secondary whitespace-nowrap text-sm">
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="btn-ghost whitespace-nowrap text-sm">
            Open
          </a>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-brand-brown/50">
        Send this to the customer to pay online by card. Works even while the store is in
        maintenance mode.
      </p>
    </div>
  )
}
