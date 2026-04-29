'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

interface CategoryTemplate {
  id: string
  name: string
  baseIngredients: string
}

interface Props {
  logoUrl: string | null
  venmoHandle: string
  cashAppTag: string
  paymentInstructions: string
  taxRate: number
  productDisclaimer: string
  categories: CategoryTemplate[]
}

export default function SettingsForm({
  logoUrl: initialLogoUrl,
  venmoHandle: initialVenmo,
  cashAppTag: initialCashApp,
  paymentInstructions: initialInstructions,
  taxRate: initialTaxRate,
  productDisclaimer: initialDisclaimer,
  categories: initialCategories,
}: Props) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [venmoHandle, setVenmoHandle] = useState(initialVenmo)
  const [cashAppTag, setCashAppTag] = useState(initialCashApp)
  const [paymentInstructions, setPaymentInstructions] = useState(initialInstructions)
  const [taxRatePct, setTaxRatePct] = useState(String((initialTaxRate * 100).toFixed(2)))
  const [productDisclaimer, setProductDisclaimer] = useState(initialDisclaimer)
  const [categories, setCategories] = useState<CategoryTemplate[]>(initialCategories)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  function updateCategoryIngredients(id: string, value: string) {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, baseIngredients: value } : c)),
    )
  }

  async function uploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoBusy(true)
    setLogoError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setLogoUrl(data.logoUrl)
      router.refresh()
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLogoBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function removeLogo() {
    if (!confirm('Remove the current logo? The site will go back to the text wordmark.')) {
      return
    }
    setLogoBusy(true)
    setLogoError(null)
    try {
      const res = await fetch('/api/admin/logo', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Remove failed')
      setLogoUrl(null)
      router.refresh()
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setLogoBusy(false)
    }
  }

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
          productDisclaimer: productDisclaimer.trim(),
          categories: categories.map((c) => ({
            id: c.id,
            baseIngredients: c.baseIngredients.trim(),
          })),
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
          Site logo
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          Shown on the public site header and footer, the admin nav, order
          emails, and printed forms. Leave empty to use the &ldquo;Smelly
          Melly&rdquo; wordmark instead. PNG, JPEG, WebP, or SVG up to 5 MB.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-20 w-20 flex items-center justify-center rounded-lg border border-brand-warm/50 bg-brand-cream/40 overflow-hidden">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Current logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-xs text-brand-brown/50 text-center px-1">
                wordmark
              </span>
            )}
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoBusy}
                className="btn-secondary text-sm"
              >
                {logoBusy ? 'Working…' : logoUrl ? 'Replace logo' : 'Upload logo'}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  disabled={logoBusy}
                  className="text-sm text-red-700 hover:text-red-900 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={uploadLogo}
              className="hidden"
            />
            {logoError && (
              <p className="text-xs text-red-700">{logoError}</p>
            )}
          </div>
        </div>
      </div>

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

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
          Category ingredient templates
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          Shared base recipe for every product in a category — Body Butter,
          Lip Balm, etc. Shown in the Ingredients & Disclosure box on each
          product page. Per-product extras still go on the product itself.
        </p>
        {categories.length === 0 ? (
          <p className="text-sm text-brand-brown/60">
            No categories yet. Add some, then come back to fill in templates.
          </p>
        ) : (
          <div className="space-y-4">
            {categories.map((c) => (
              <div key={c.id}>
                <label className="block text-xs text-brand-brown/60 mb-1">
                  {c.name}
                </label>
                <textarea
                  value={c.baseIngredients}
                  onChange={(e) =>
                    updateCategoryIngredients(c.id, e.target.value)
                  }
                  rows={3}
                  placeholder="e.g. Shea butter, mango butter, jojoba oil, vitamin E, fragrance oil"
                  className="input resize-y"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
          Product disclaimer
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          Legal blurb appended to every product&apos;s Ingredients & Disclosure
          box — allergen warnings, FDA disclaimer, patch-test reminder, etc.
        </p>
        <textarea
          value={productDisclaimer}
          onChange={(e) => setProductDisclaimer(e.target.value)}
          rows={5}
          placeholder="Handmade in small batches. May contain nuts, shea, beeswax, essential oils…"
          className="input resize-y"
        />
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
