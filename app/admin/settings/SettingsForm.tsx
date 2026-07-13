'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'

interface CategoryTemplate {
  id: string
  name: string
  baseIngredients: string
}

type AllergenSeverity = 'high' | 'normal'

interface AllergenRow {
  id: string
  label: string
  matchTerms: string
  severity: AllergenSeverity
  sortOrder: number
  isActive: boolean
}

interface Props {
  logoUrl: string | null
  businessEmail: string
  businessPhone: string
  venmoHandle: string
  cashAppTag: string
  paymentInstructions: string
  taxRate: number
  productDisclaimer: string
  announcementActive: boolean
  announcementText: string
  announcementLink: string
  categories: CategoryTemplate[]
  allergens: AllergenRow[]
}

export default function SettingsForm({
  logoUrl: initialLogoUrl,
  businessEmail: initialEmail,
  businessPhone: initialPhone,
  venmoHandle: initialVenmo,
  cashAppTag: initialCashApp,
  paymentInstructions: initialInstructions,
  taxRate: initialTaxRate,
  productDisclaimer: initialDisclaimer,
  announcementActive: initialAnnounceActive,
  announcementText: initialAnnounceText,
  announcementLink: initialAnnounceLink,
  categories: initialCategories,
  allergens: initialAllergens,
}: Props) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [businessEmail, setBusinessEmail] = useState(initialEmail)
  const [businessPhone, setBusinessPhone] = useState(initialPhone)
  const [venmoHandle, setVenmoHandle] = useState(initialVenmo)
  const [cashAppTag, setCashAppTag] = useState(initialCashApp)
  const [paymentInstructions, setPaymentInstructions] = useState(initialInstructions)
  const [taxRatePct, setTaxRatePct] = useState(String((initialTaxRate * 100).toFixed(2)))
  const [productDisclaimer, setProductDisclaimer] = useState(initialDisclaimer)
  const [announcementActive, setAnnouncementActive] = useState(initialAnnounceActive)
  const [announcementText, setAnnouncementText] = useState(initialAnnounceText)
  const [announcementLink, setAnnouncementLink] = useState(initialAnnounceLink)
  const [categories, setCategories] = useState<CategoryTemplate[]>(initialCategories)
  const [allergens, setAllergens] = useState<AllergenRow[]>(initialAllergens)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  function updateCategoryIngredients(id: string, value: string) {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, baseIngredients: value } : c)),
    )
  }

  function updateAllergen<K extends keyof AllergenRow>(
    id: string,
    key: K,
    value: AllergenRow[K],
  ) {
    setAllergens((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [key]: value } : a)),
    )
  }

  function addAllergen() {
    const nextSortOrder =
      allergens.reduce((max, a) => Math.max(max, a.sortOrder), 0) + 10
    const tempId = `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    setAllergens((prev) => [
      ...prev,
      {
        id: tempId,
        label: '',
        matchTerms: '',
        severity: 'normal',
        sortOrder: nextSortOrder,
        isActive: true,
      },
    ])
  }

  function removeAllergen(id: string) {
    setAllergens((prev) => prev.filter((a) => a.id !== id))
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
          businessEmail: businessEmail.trim(),
          businessPhone: businessPhone.trim(),
          venmoHandle: venmoHandle.trim(),
          cashAppTag: cashAppTag.trim(),
          paymentInstructions: paymentInstructions.trim(),
          taxRate: pct / 100,
          productDisclaimer: productDisclaimer.trim(),
          announcementActive,
          announcementText: announcementText.trim(),
          announcementLink: announcementLink.trim(),
          categories: categories.map((c) => ({
            id: c.id,
            baseIngredients: c.baseIngredients.trim(),
          })),
          allergens: allergens
            .filter((a) => a.label.trim() && a.matchTerms.trim())
            .map((a) => ({
              id: a.id.startsWith('new_') ? null : a.id,
              label: a.label.trim(),
              matchTerms: a.matchTerms.trim(),
              severity: a.severity,
              sortOrder: a.sortOrder,
              isActive: a.isActive,
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
          Business contact
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          Shown publicly on the Contact page and printed on product labels.
          Update here and it changes everywhere it&apos;s posted.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">
              Contact email
            </label>
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="smellymellysinc@gmail.com"
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs text-brand-brown/60 mb-1">
              Contact phone
            </label>
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="240-362-9352"
              className="input"
            />
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

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
          Announcement banner
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          A colored bar across the top of every storefront page. Use it for sales,
          shipping cutoffs, or holiday hours. Turn it off to hide it.
        </p>
        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={announcementActive}
            onChange={(e) => setAnnouncementActive(e.target.checked)}
            className="h-4 w-4 rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
          />
          <span className="text-sm font-medium text-brand-brown">Show the banner</span>
        </label>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">Message</label>
            <input
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="Free local pickup this weekend! 🎉"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-brown mb-1">
              Link (optional)
            </label>
            <input
              value={announcementLink}
              onChange={(e) => setAnnouncementLink(e.target.value)}
              placeholder="/shop or https://…"
              className="input w-full"
            />
            <p className="mt-1 text-xs text-brand-brown/50">
              When set, the whole banner links here.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-display text-lg font-semibold text-brand-dark mb-1">
          Allergen pills
        </h2>
        <p className="text-xs text-brand-brown/60 mb-4">
          Each row is a pill that lights up on a product page when its match
          terms appear in the recipe text. <strong>Match</strong> is one or
          more comma-separated words (case-insensitive, whole-word only).
          <strong> High</strong> = red pill, <strong>Normal</strong> = amber.
          Uncheck Active to hide a pill without deleting it.
        </p>
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-12 gap-2 text-[11px] uppercase tracking-wide text-brand-brown/50 px-1">
            <div className="col-span-3">Label</div>
            <div className="col-span-5">Match (comma-separated)</div>
            <div className="col-span-2">Severity</div>
            <div className="col-span-1 text-center">Active</div>
            <div className="col-span-1"></div>
          </div>
          {allergens.length === 0 && (
            <p className="text-sm text-brand-brown/60">No allergens yet.</p>
          )}
          {allergens.map((a) => (
            <div
              key={a.id}
              className="grid grid-cols-12 gap-2 items-center"
            >
              <input
                type="text"
                value={a.label}
                onChange={(e) => updateAllergen(a.id, 'label', e.target.value)}
                placeholder="Shea"
                className="input col-span-12 sm:col-span-3"
              />
              <input
                type="text"
                value={a.matchTerms}
                onChange={(e) =>
                  updateAllergen(a.id, 'matchTerms', e.target.value)
                }
                placeholder="shea, shea butter"
                className="input col-span-12 sm:col-span-5"
              />
              <select
                value={a.severity}
                onChange={(e) =>
                  updateAllergen(
                    a.id,
                    'severity',
                    e.target.value as AllergenSeverity,
                  )
                }
                className="input col-span-6 sm:col-span-2"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
              <label className="col-span-3 sm:col-span-1 flex items-center justify-center text-xs text-brand-brown/70">
                <input
                  type="checkbox"
                  checked={a.isActive}
                  onChange={(e) =>
                    updateAllergen(a.id, 'isActive', e.target.checked)
                  }
                  className="h-4 w-4"
                />
              </label>
              <button
                type="button"
                onClick={() => removeAllergen(a.id)}
                className="col-span-3 sm:col-span-1 text-xs text-red-700 hover:text-red-900"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addAllergen}
          className="btn-secondary text-sm mt-4"
        >
          + Add allergen
        </button>
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
