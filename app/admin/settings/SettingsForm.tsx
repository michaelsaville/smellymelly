'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  venmoHandle: string
  cashAppTag: string
  paymentInstructions: string
  taxRate: number
}

export default function SettingsForm({
  venmoHandle: initialVenmo,
  cashAppTag: initialCashApp,
  paymentInstructions: initialInstructions,
  taxRate: initialTaxRate,
}: Props) {
  const router = useRouter()
  const [venmoHandle, setVenmoHandle] = useState(initialVenmo)
  const [cashAppTag, setCashAppTag] = useState(initialCashApp)
  const [paymentInstructions, setPaymentInstructions] = useState(initialInstructions)
  const [taxRatePct, setTaxRatePct] = useState(String((initialTaxRate * 100).toFixed(2)))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const pct = Number(taxRatePct)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setError('Tax rate must be between 0 and 100')
      return
    }
    setStatus('saving')
    setError(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venmoHandle: venmoHandle.trim(),
          cashAppTag: cashAppTag.trim(),
          paymentInstructions: paymentInstructions.trim(),
          taxRate: pct / 100,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
      router.refresh()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
          Manual payment handles
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          Shown on the confirmation screen and email when a customer picks
          &quot;Pay directly via Venmo / Cash App&quot; at checkout.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">
              Venmo handle
            </label>
            <input
              type="text"
              value={venmoHandle}
              onChange={(e) => setVenmoHandle(e.target.value)}
              placeholder="@YourVenmoName"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">
              Cash App cashtag
            </label>
            <input
              type="text"
              value={cashAppTag}
              onChange={(e) => setCashAppTag(e.target.value)}
              placeholder="$YourCashtag"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">
              Extra instructions (optional)
            </label>
            <textarea
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              rows={3}
              placeholder="Anything else the buyer should know — preferred note format, hours, etc."
              className="input resize-y"
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
          Tax
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          Applied to every order&apos;s subtotal at checkout. Currently flat
          for all states — per-state rates are future work.
        </p>
        <div>
          <label className="block text-xs text-brand-brown/60 mb-1">
            Tax rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={taxRatePct}
            onChange={(e) => setTaxRatePct(e.target.value)}
            className="input max-w-[160px]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-brand-brown/50">
          {status === 'saving' && 'Saving…'}
          {status === 'saved' && 'Saved'}
          {status === 'error' && 'Save failed'}
        </span>
        <button
          type="button"
          onClick={save}
          disabled={status === 'saving'}
          className="btn-primary disabled:opacity-50"
        >
          Save settings
        </button>
      </div>
    </div>
  )
}
