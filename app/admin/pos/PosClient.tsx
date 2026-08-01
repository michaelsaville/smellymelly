'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPosSale,
  type PosTender,
  type PosDiscount,
  type PosGiftCardSale,
} from '@/app/lib/actions/pos'
import { lookupGiftCard } from '@/app/lib/actions/gift-cards'

/** A certificate the customer is paying WITH, once we've looked it up. */
interface AppliedGiftCard {
  id: string
  formattedCode: string
  /** What's on the card. */
  balanceCents: number
  /** What we're actually taking off this sale (min of balance and what's due). */
  amountCents: number
}

interface PosVariant {
  id: string
  productId: string
  product: string // product name = the item "type"
  category: string | null
  scent: string // parsed; '' when the variant has no scent
  size: string // parsed; '' when the variant has no size
  priceCents: number
  stock: number
}

const TENDER_METHODS = ['Cash', 'Venmo', 'Cash App', 'Card'] as const
const STORAGE_KEY = 'sm_pos_cart_v2'

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}
function dollarsToCents(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
function sizeWeight(size: string): number {
  const m = size.match(/^(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : Number.POSITIVE_INFINITY
}
function variantLabel(v: PosVariant): string {
  return [v.scent, v.size].filter(Boolean).join(' · ') || 'Standard'
}

type SizeGroup = { size: string; variants: PosVariant[] }
type ProductGroup = { productId: string; product: string; category: string | null; sizes: SizeGroup[] }
type Line = { v: PosVariant; qty: number }

// ─── Numeric keypad (cash entry) ────────────────────────────────────────────
function Keypad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className="h-14 rounded-lg border border-brand-warm/60 bg-white text-xl font-semibold text-brand-dark active:bg-brand-warm/40"
        >
          {k}
        </button>
      ))}
    </div>
  )
}

// ─── Tender modal ───────────────────────────────────────────────────────────
/**
 * Applying a gift certificate at the till. Kept at module scope, not nested in
 * TenderSheet — an inline sub-component remounts its <input> on every parent
 * render and the code field loses focus after one keystroke.
 */
function GiftRedeemPanel({
  applied,
  maxCents,
  onApply,
  onRemove,
}: {
  applied: AppliedGiftCard | null
  /** Ceiling on what a certificate may cover — excludes certificates being
   *  sold on this same sale. Zero means redemption isn't offered at all. */
  maxCents: number
  onApply: (c: AppliedGiftCard) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function lookup() {
    if (busy || !code.trim()) return
    setBusy(true)
    setErr(null)
    const res = await lookupGiftCard(code)
    setBusy(false)
    if (!res.ok) {
      setErr(res.error)
      return
    }
    onApply({
      id: res.card.id,
      formattedCode: res.card.formattedCode,
      balanceCents: res.card.balanceCents,
      amountCents: Math.min(res.card.balanceCents, maxCents),
    })
    setCode('')
    setOpen(false)
  }

  if (maxCents <= 0 && !applied) return null

  if (applied) {
    return (
      <div className="mb-3 rounded-lg border border-green-300 bg-green-50 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-green-900">
              {applied.formattedCode}
            </div>
            <div className="text-xs text-green-800">
              Applying {money(applied.amountCents)}
              {applied.balanceCents > applied.amountCents &&
                ` · ${money(applied.balanceCents - applied.amountCents)} left after`}
            </div>
          </div>
          <button type="button" onClick={onRemove} className="text-xs text-green-900 underline">
            Remove
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3">
      {open ? (
        <div className="rounded-lg border border-brand-warm/60 bg-white p-2">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookup()}
              placeholder="SM-XXXX-XXXX-XXX"
              autoFocus
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="input flex-1 font-mono text-sm"
            />
            <button
              type="button"
              onClick={lookup}
              disabled={busy}
              className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {busy ? '…' : 'Apply'}
            </button>
          </div>
          {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setErr(null)
            }}
            className="mt-1.5 text-xs text-brand-brown/50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-brand-brown/60 hover:text-brand-terra"
        >
          + Use a gift certificate
        </button>
      )}
    </div>
  )
}

function TenderSheet({
  totalCents,
  giftCard,
  giftCardMaxCents,
  onApplyGiftCard,
  onRemoveGiftCard,
  busy,
  error,
  onCancel,
  onComplete,
}: {
  /** Full price of the sale. A certificate is a tender, so it does not change
   *  this — it reduces what's left to collect. */
  totalCents: number
  giftCard: AppliedGiftCard | null
  giftCardMaxCents: number
  onApplyGiftCard: (c: AppliedGiftCard) => void
  onRemoveGiftCard: () => void
  busy: boolean
  error: string | null
  onCancel: () => void
  onComplete: (r: { tenders: PosTender[]; cashTenderedCents?: number }) => void
}) {
  const [split, setSplit] = useState(false)
  const [method, setMethod] = useState<string>('Cash')
  const [note, setNote] = useState('') // reference for non-cash single tender
  const [entry, setEntry] = useState('') // dollars typed on the keypad
  // split legs
  const [legAMethod, setLegAMethod] = useState('Cash')
  const [legBMethod, setLegBMethod] = useState('Card')

  const entryCents = dollarsToCents(entry || '0')
  // What's actually left to collect in cash/card once the certificate is on.
  const dueCents = Math.max(0, totalCents - (giftCard?.amountCents ?? 0))
  const fullyCovered = dueCents === 0

  function pushKey(k: string) {
    setEntry((prev) => {
      if (k === '⌫') return prev.slice(0, -1)
      if (k === '.') return prev.includes('.') ? prev : (prev || '0') + '.'
      const next = prev + k
      const dot = next.indexOf('.')
      if (dot >= 0 && next.length - dot - 1 > 2) return prev // max 2 decimals
      return next
    })
  }

  // Smart quick-cash presets: exact, then the next round bills above the total.
  const quickCash = useMemo(() => {
    const set = new Set<number>([dueCents])
    const d = dueCents / 100
    set.add(Math.ceil(d / 5) * 5 * 100)
    set.add(Math.ceil(d / 10) * 10 * 100)
    set.add(Math.ceil(d / 20) * 20 * 100)
    ;[20, 40, 50, 100].forEach((b) => set.add(b * 100))
    return Array.from(set)
      .filter((v) => v >= dueCents)
      .sort((a, b) => a - b)
      .slice(0, 4)
  }, [dueCents])

  const changeCents = method === 'Cash' && entryCents > dueCents ? entryCents - dueCents : 0
  const cashOk = method !== 'Cash' || entryCents >= dueCents

  // Split: leg A amount from keypad, leg B = remainder
  const legA = Math.min(Math.max(entryCents, 0), dueCents)
  const legB = dueCents - legA
  const splitOk = legA > 0 && legB > 0 && legAMethod !== legBMethod

  function methodChips(active: string, set: (m: string) => void, size: 'lg' | 'sm' = 'lg') {
    return (
      <div className={size === 'lg' ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-1.5'}>
        {TENDER_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              set(m)
              if (size === 'lg') setEntry('')
            }}
            className={`${size === 'lg' ? 'h-12' : 'h-9 px-3'} rounded-full text-sm font-medium ${
              active === m ? 'bg-brand-terra text-white' : 'bg-brand-warm/50 text-brand-brown'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    )
  }

  function finish() {
    if (busy) return
    // The certificate covered the whole sale — there is nothing to collect.
    if (fullyCovered) {
      onComplete({ tenders: [] })
      return
    }
    if (split) {
      if (!splitOk) return
      onComplete({
        tenders: [
          { method: legAMethod, amountCents: legA },
          { method: legBMethod, amountCents: legB },
        ],
      })
      return
    }
    if (method === 'Cash') {
      if (entryCents < dueCents) return
      onComplete({
        tenders: [{ method: 'Cash', amountCents: dueCents }],
        cashTenderedCents: entryCents,
      })
    } else {
      onComplete({ tenders: [{ method, amountCents: dueCents, note: note.trim() || undefined }] })
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-surface-warm p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-brand-dark">
            Charge {money(dueCents)}
            {giftCard && (
              <span className="ml-2 text-sm font-normal text-brand-brown/50 line-through">
                {money(totalCents)}
              </span>
            )}
          </h2>
          <button type="button" onClick={onCancel} className="text-brand-brown/60 hover:text-brand-brown text-sm">
            ← Back to sale
          </button>
        </div>

        <GiftRedeemPanel
          applied={giftCard}
          maxCents={giftCardMaxCents}
          onApply={onApplyGiftCard}
          onRemove={onRemoveGiftCard}
        />

        {fullyCovered ? (
          <div className="rounded-lg bg-green-50 p-4 text-center">
            <p className="text-sm text-green-800">
              The certificate covers the whole sale. Nothing to collect.
            </p>
          </div>
        ) : (
          <>
        {/* Single vs split toggle */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSplit(false)}
            className={`h-10 rounded-lg text-sm font-medium ${!split ? 'bg-brand-dark text-white' : 'bg-brand-warm/50 text-brand-brown'}`}
          >
            One payment
          </button>
          <button
            type="button"
            onClick={() => setSplit(true)}
            className={`h-10 rounded-lg text-sm font-medium ${split ? 'bg-brand-dark text-white' : 'bg-brand-warm/50 text-brand-brown'}`}
          >
            Split 2 ways
          </button>
        </div>

        {!split ? (
          <>
            <div className="mb-3">{methodChips(method, setMethod)}</div>

            {method === 'Cash' ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {quickCash.map((c, i) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEntry((c / 100).toFixed(2))}
                      className="h-10 rounded-full bg-brand-warm/50 px-4 text-sm font-medium text-brand-brown active:bg-brand-warm"
                    >
                      {i === 0 ? `Exact ${money(c)}` : money(c)}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-brand-warm/60 bg-white px-3 py-2 text-right">
                  <span className="text-xs text-brand-brown/50">Cash received</span>
                  <div className="font-display text-2xl font-bold tabular-nums text-brand-dark">
                    {entry ? money(entryCents) : '$0.00'}
                  </div>
                </div>
                <Keypad onKey={pushKey} />
                <div
                  aria-live="polite"
                  className={`rounded-lg px-3 py-2 text-center ${changeCents > 0 ? 'bg-green-100' : 'bg-surface-muted'}`}
                >
                  <span className="text-xs text-brand-brown/60">Change due</span>
                  <div className="font-display text-2xl font-bold tabular-nums text-green-700">
                    {money(changeCents)}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-brown/80">
                  Reference (optional)
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={method === 'Card' ? 'e.g. last 4 digits' : 'e.g. @mel-soaps'}
                  className="input w-full text-sm"
                />
                <p className="mt-2 text-xs text-brand-brown/50">
                  Confirm the {money(dueCents)} payment was received in {method}, then tap Done.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-brand-brown/50">
                First payment
              </div>
              {methodChips(legAMethod, setLegAMethod, 'sm')}
              <div className="mt-2 rounded-lg border border-brand-warm/60 bg-white px-3 py-2 text-right">
                <span className="text-xs text-brand-brown/50">Amount</span>
                <div className="font-display text-2xl font-bold tabular-nums text-brand-dark">
                  {money(legA)}
                </div>
              </div>
              <div className="mt-2">
                <Keypad onKey={pushKey} />
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-brand-brown/50">
                Remaining {money(legB)} on
              </div>
              {methodChips(legBMethod, setLegBMethod, 'sm')}
            </div>
            {legAMethod === legBMethod && (
              <p className="text-xs text-amber-600">Pick two different methods for a split.</p>
            )}
          </div>
        )}
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={finish}
          disabled={busy || (fullyCovered ? false : split ? !splitOk : !cashOk)}
          className="btn-primary mt-4 h-14 w-full text-base disabled:opacity-50"
        >
          {busy ? 'Recording…' : fullyCovered ? 'Complete sale' : 'Done'}
        </button>
      </div>
    </div>
  )
}

// ─── Cart / sale panel (shared by desktop rail + mobile sheet) ──────────────
function CartPanel({
  lines,
  subtotal,
  discount,
  setDiscount,
  discountCents,
  taxable,
  setTaxable,
  taxRate,
  total,
  giftCards,
  onAddGiftCard,
  onRemoveGiftCard,
  customer,
  setCustomer,
  onQty,
  onRemove,
  onClear,
  onCharge,
  soldOutId,
  error,
  onClose,
}: {
  lines: Line[]
  subtotal: number
  discount: PosDiscount | null
  setDiscount: (d: PosDiscount | null) => void
  discountCents: number
  taxable: boolean
  setTaxable: (b: boolean) => void
  taxRate: number
  total: number
  giftCards: PosGiftCardSale[]
  onAddGiftCard: (amountCents: number) => void
  onRemoveGiftCard: (index: number) => void
  customer: { name: string; email: string; phone: string }
  setCustomer: (c: { name: string; email: string; phone: string }) => void
  onQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  onCharge: () => void
  soldOutId: string | null
  error: string | null
  onClose?: () => void
}) {
  const [showDiscount, setShowDiscount] = useState(false)
  const [showCustomer, setShowCustomer] = useState(false)
  const [showGift, setShowGift] = useState(false)
  const [giftInput, setGiftInput] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const [discMode, setDiscMode] = useState<'pct' | 'amt'>(discount?.mode ?? 'amt')
  const [discInput, setDiscInput] = useState('')
  const count = lines.reduce((n, l) => n + l.qty, 0)
  const giftTotal = giftCards.reduce((s, g) => s + g.amountCents, 0)

  function addGift(dollars: number) {
    if (!(dollars > 0)) return
    onAddGiftCard(Math.round(dollars * 100))
    setGiftInput('')
    setShowGift(false)
  }

  function applyDiscount(mode: 'pct' | 'amt', value: number) {
    if (value <= 0) {
      setDiscount(null)
      return
    }
    setDiscount({ mode, value: mode === 'amt' ? Math.round(value * 100) : value })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between pb-2">
        <h2 className="font-display text-lg font-bold text-brand-dark">
          Sale {count > 0 && <span className="text-sm font-normal text-brand-brown/50">· {count}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {lines.length > 0 &&
            (confirmClear ? (
              <span className="flex items-center gap-1 text-xs">
                <button type="button" onClick={() => { onClear(); setConfirmClear(false) }} className="rounded bg-red-600 px-2 py-1 font-medium text-white">
                  Clear all
                </button>
                <button type="button" onClick={() => setConfirmClear(false)} className="px-1 text-brand-brown/60">
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className="text-xs text-brand-brown/50 hover:text-red-600">
                Clear
              </button>
            ))}
          {onClose && (
            <button type="button" onClick={onClose} className="text-lg leading-none text-brand-brown/60">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Sold-out banner */}
      {soldOutId && error && (
        <div className="mb-2 shrink-0 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
          {error}
          <button
            type="button"
            onClick={() => onRemove(soldOutId)}
            className="ml-1 font-semibold underline"
          >
            Remove &amp; retry
          </button>
        </div>
      )}

      {/* Lines */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {lines.length === 0 && giftCards.length === 0 ? (
          <p className="py-6 text-sm text-brand-brown/50">Tap products to add them.</p>
        ) : (
          <div className="space-y-2.5">
            {lines.map((l) => (
              <div key={l.v.id} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-brand-dark">{l.v.product}</div>
                  <div className="truncate text-xs text-brand-brown/50">{variantLabel(l.v)}</div>
                </div>
                <div className="flex items-center rounded-lg border border-brand-warm/60">
                  <button type="button" onClick={() => onQty(l.v.id, l.qty - 1)} className="h-11 w-11 text-xl text-brand-brown" aria-label="Decrease">
                    −
                  </button>
                  <span className="w-7 text-center tabular-nums">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => onQty(l.v.id, l.qty + 1)}
                    disabled={l.qty >= l.v.stock}
                    className="h-11 w-11 text-xl text-brand-brown disabled:opacity-30"
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
                <span className="w-16 text-right font-medium tabular-nums text-brand-dark">
                  {money(l.v.priceCents * l.qty)}
                </span>
                <button type="button" onClick={() => onRemove(l.v.id)} aria-label="Remove" className="text-brand-brown/30 hover:text-red-500">
                  ✕
                </button>
              </div>
            ))}

            {/* Certificates being sold. No quantity stepper — each one is its
                own certificate with its own code, so two $10s aren't a "2". */}
            {giftCards.map((g, i) => (
              <div key={`gc-${i}`} className="flex items-center gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-brand-dark">Gift certificate</div>
                  <div className="truncate text-xs text-brand-brown/50">No tax · code on print</div>
                </div>
                <span className="w-16 text-right font-medium tabular-nums text-brand-dark">
                  {money(g.amountCents)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveGiftCard(i)}
                  aria-label="Remove certificate"
                  className="text-brand-brown/30 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals + tender */}
      <div className="shrink-0 border-t border-brand-warm/40 pt-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-brand-brown">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </div>

          {/* Discount */}
          {discountCents > 0 ? (
            <div className="flex items-center justify-between text-brand-terra">
              <button type="button" onClick={() => setShowDiscount((s) => !s)} className="underline-offset-2 hover:underline">
                Discount {discount?.mode === 'pct' ? `(${discount.value}%)` : ''}
              </button>
              <span className="flex items-center gap-2 tabular-nums">
                −{money(discountCents)}
                <button type="button" onClick={() => { setDiscount(null); setDiscInput('') }} aria-label="Remove discount" className="text-brand-brown/40">
                  ✕
                </button>
              </span>
            </div>
          ) : (
            lines.length > 0 && (
              <button type="button" onClick={() => setShowDiscount((s) => !s)} className="text-xs text-brand-brown/50 hover:text-brand-terra">
                + Add discount
              </button>
            )
          )}

          {showDiscount && (
            <div className="rounded-lg border border-brand-warm/60 bg-white p-2 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-brand-warm/60 text-xs">
                  <button type="button" onClick={() => setDiscMode('amt')} className={`px-3 py-1.5 ${discMode === 'amt' ? 'bg-brand-terra text-white' : 'text-brand-brown'}`}>$</button>
                  <button type="button" onClick={() => setDiscMode('pct')} className={`px-3 py-1.5 ${discMode === 'pct' ? 'bg-brand-terra text-white' : 'text-brand-brown'}`}>%</button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={discInput}
                  onChange={(e) => setDiscInput(e.target.value)}
                  placeholder={discMode === 'pct' ? '10' : '2.00'}
                  className="input flex-1 text-sm"
                />
                <button type="button" onClick={() => { applyDiscount(discMode, parseFloat(discInput || '0')); setShowDiscount(false) }} className="btn-primary text-sm px-3 py-1.5">
                  Apply
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[{ l: '10%', m: 'pct' as const, v: 10 }, { l: '$1', m: 'amt' as const, v: 1 }, { l: '$5', m: 'amt' as const, v: 5 }].map((p) => (
                  <button key={p.l} type="button" onClick={() => { applyDiscount(p.m, p.v); setDiscMode(p.m); setShowDiscount(false) }} className="rounded-full bg-brand-warm/50 px-3 py-1 text-xs font-medium text-brand-brown">
                    {p.l} off
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sell a certificate */}
          {showGift ? (
            <div className="space-y-2 rounded-lg border border-brand-warm/60 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-brown/80">Gift certificate</span>
                <button type="button" onClick={() => setShowGift(false)} className="text-xs text-brand-brown/50">
                  Hide
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[10, 20, 25, 50].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => addGift(d)}
                    className="rounded-full bg-brand-warm/50 px-3 py-1.5 text-xs font-medium text-brand-brown"
                  >
                    ${d}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={giftInput}
                  onChange={(e) => setGiftInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGift(parseFloat(giftInput || '0'))}
                  placeholder="Other amount"
                  className="input flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => addGift(parseFloat(giftInput || '0'))}
                  className="btn-primary px-3 py-1.5 text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowGift(true)} className="block text-xs text-brand-brown/50 hover:text-brand-terra">
              + Sell a gift certificate
            </button>
          )}

          <label className="flex items-center justify-between text-brand-brown/70">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} className="h-4 w-4 rounded border-brand-warm text-brand-terra focus:ring-brand-terra" />
              Tax ({(taxRate * 100).toFixed(0)}%)
            </span>
            <span className="tabular-nums">{money(taxable ? Math.round((subtotal - giftTotal - discountCents) * taxRate) : 0)}</span>
          </label>
          {giftTotal > 0 && (
            <p className="text-[11px] text-brand-brown/50">
              Certificates aren&apos;t taxed here — tax gets charged on whatever they buy later.
            </p>
          )}
          <div className="flex justify-between border-t border-brand-warm/40 pt-2 font-display text-lg font-semibold text-brand-dark">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>

        {/* Customer (optional) */}
        <div className="mt-3">
          {showCustomer ? (
            <div className="space-y-2 rounded-lg border border-brand-warm/60 bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brand-brown/80">Customer (optional)</span>
                <button type="button" onClick={() => setShowCustomer(false)} className="text-xs text-brand-brown/50">Hide</button>
              </div>
              <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Name" className="input w-full text-sm" />
              <input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Email for receipt" type="email" className="input w-full text-sm" />
              {customer.email.trim() && (
                <p className="text-[11px] text-brand-brown/50">Receipt emails once SMTP is connected; saved to CRM now.</p>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setShowCustomer(true)} className="text-xs text-brand-brown/50 hover:text-brand-terra">
              + Add customer {customer.email.trim() ? `(${customer.email.trim()})` : ''}
            </button>
          )}
        </div>

        {error && !soldOutId && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <button
          onClick={onCharge}
          disabled={lines.length === 0 && giftCards.length === 0}
          className="btn-primary mt-3 h-14 w-full text-base disabled:opacity-50"
        >
          Charge · {money(total)}
        </button>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function PosClient({
  variants,
  taxRate,
  hideOutOfStock: hideInitial,
}: {
  variants: PosVariant[]
  taxRate: number
  hideOutOfStock: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [taxable, setTaxable] = useState(true)
  const [discount, setDiscount] = useState<PosDiscount | null>(null)
  const [giftCards, setGiftCards] = useState<PosGiftCardSale[]>([])
  const [redeemCard, setRedeemCard] = useState<AppliedGiftCard | null>(null)
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '' })
  const [hideOOS, setHideOOS] = useState(hideInitial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soldOutId, setSoldOutId] = useState<string | null>(null)
  const [tenderOpen, setTenderOpen] = useState(false)
  const [cartSheetOpen, setCartSheetOpen] = useState(false)
  const [done, setDone] = useState<{
    orderNumber: number
    totalCents: number
    changeCents: number
    giftCardCents: number
    issuedGiftCards: { id: string; code: string; amountCents: number }[]
    email: string
  } | null>(null)
  const submittingRef = useRef(false)
  const hydrated = useRef(false)
  /** Identifies one checkout attempt. Minted when the tender sheet opens and
   *  held until a sale succeeds, so a retried request is recognised as the
   *  same attempt rather than a second one. */
  const saleIdRef = useRef<string | null>(null)

  const vMap = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])

  // Hydrate saved cart once on mount (survives an iPad backgrounding mid-sale).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (s.cart) {
          const clean: Record<string, number> = {}
          for (const [id, qty] of Object.entries(s.cart as Record<string, number>)) {
            const v = vMap.get(id)
            if (v && v.stock > 0) clean[id] = Math.min(qty, v.stock)
          }
          setCart(clean)
        }
        if (s.discount) setDiscount(s.discount)
        if (Array.isArray(s.giftCards)) setGiftCards(s.giftCards)
        if (typeof s.taxable === 'boolean') setTaxable(s.taxable)
        if (s.customer) setCustomer(s.customer)
      }
    } catch {
      /* ignore corrupt storage */
    }
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist cart state.
  useEffect(() => {
    if (!hydrated.current) return
    try {
      // redeemCard is deliberately NOT persisted — a certificate balance can
      // change on another till, so it's re-looked-up each time.
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ cart, discount, giftCards, taxable, customer }),
      )
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [cart, discount, giftCards, taxable, customer])

  // Warn before leaving with an unfinished sale.
  useEffect(() => {
    const has = Object.values(cart).some((q) => q > 0) || giftCards.length > 0
    if (!has) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [cart, giftCards])

  const categories = useMemo(() => {
    const set = new Set<string>()
    variants.forEach((v) => v.category && set.add(v.category))
    return ['All', ...Array.from(set).sort()]
  }, [variants])

  const groups = useMemo<ProductGroup[]>(() => {
    const q = search.trim().toLowerCase()
    const filtered = variants.filter((v) => {
      if (hideOOS && v.stock <= 0) return false
      if (category !== 'All' && v.category !== category) return false
      if (!q) return true
      return [v.product, v.scent, v.size, v.category ?? ''].join(' ').toLowerCase().includes(q)
    })
    const byProduct = new Map<string, ProductGroup>()
    for (const v of filtered) {
      let g = byProduct.get(v.productId)
      if (!g) {
        g = { productId: v.productId, product: v.product, category: v.category, sizes: [] }
        byProduct.set(v.productId, g)
      }
      let sg = g.sizes.find((s) => s.size === v.size)
      if (!sg) {
        sg = { size: v.size, variants: [] }
        g.sizes.push(sg)
      }
      sg.variants.push(v)
    }
    for (const g of byProduct.values()) g.sizes.sort((a, b) => sizeWeight(a.size) - sizeWeight(b.size))
    return Array.from(byProduct.values())
  }, [variants, search, category, hideOOS])

  const lines: Line[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({ v: vMap.get(id)!, qty }))
        .filter((l) => l.v),
    [cart, vMap],
  )

  // Mirrors createPosSale exactly: certificates are never taxed and never
  // discounted, so the discount and tax bases are merchandise only.
  const merchSubtotal = lines.reduce((s, l) => s + l.v.priceCents * l.qty, 0)
  const giftSoldCents = giftCards.reduce((s, g) => s + g.amountCents, 0)
  const subtotal = merchSubtotal + giftSoldCents
  const discountCents = useMemo(() => {
    if (!discount || discount.value <= 0) return 0
    const raw =
      discount.mode === 'pct'
        ? Math.round((merchSubtotal * Math.min(discount.value, 100)) / 100)
        : Math.round(discount.value)
    return Math.max(0, Math.min(raw, merchSubtotal))
  }, [discount, merchSubtotal])
  const tax = taxable ? Math.round((merchSubtotal - discountCents) * taxRate) : 0
  const total = merchSubtotal - discountCents + tax + giftSoldCents
  // A certificate can't pay for a certificate, so redemption is capped at the
  // merchandise part of the sale.
  const redeemableCents = Math.max(0, total - giftSoldCents)

  function add(v: PosVariant) {
    setError(null)
    setCart((prev) => {
      const cur = prev[v.id] ?? 0
      if (cur >= v.stock) return prev
      return { ...prev, [v.id]: cur + 1 }
    })
  }
  function setQty(id: string, qty: number) {
    const v = vMap.get(id)
    const capped = Math.max(0, Math.min(qty, v?.stock ?? qty))
    setCart((prev) => {
      const next = { ...prev }
      if (capped <= 0) delete next[id]
      else next[id] = capped
      return next
    })
  }
  function removeLine(id: string) {
    setCart((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (soldOutId === id) {
      setSoldOutId(null)
      setError(null)
    }
  }
  function clearCart() {
    setCart({})
    setDiscount(null)
    setGiftCards([])
    setRedeemCard(null)
  }

  function addGiftCard(amountCents: number) {
    setError(null)
    setGiftCards((prev) => [...prev, { amountCents }])
  }
  function removeGiftCard(index: number) {
    setGiftCards((prev) => prev.filter((_, i) => i !== index))
  }

  function openTender() {
    // One id per checkout attempt, held until the sale succeeds.
    if (!saleIdRef.current) {
      saleIdRef.current =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    setTenderOpen(true)
  }

  // Re-clamp every render: the operator can shrink the cart after applying a
  // certificate, and we must never take more off the card than the sale needs.
  const appliedGiftCard: AppliedGiftCard | null = redeemCard
    ? { ...redeemCard, amountCents: Math.min(redeemCard.balanceCents, redeemableCents) }
    : null
  const giftCardCents = appliedGiftCard?.amountCents ?? 0

  async function submit(r: { tenders: PosTender[]; cashTenderedCents?: number }) {
    if (submittingRef.current || (lines.length === 0 && giftCards.length === 0)) return
    submittingRef.current = true
    setBusy(true)
    setError(null)
    setSoldOutId(null)
    try {
      const res = await createPosSale({
        items: lines.map((l) => ({ variantId: l.v.id, quantity: l.qty })),
        taxable,
        discount,
        tenders: r.tenders,
        cashTenderedCents: r.cashTenderedCents,
        giftCardsSold: giftCards,
        giftCardPayment:
          appliedGiftCard && appliedGiftCard.amountCents > 0
            ? { cardId: appliedGiftCard.id, amountCents: appliedGiftCard.amountCents }
            : null,
        // Stable for this checkout attempt, so a retried request can't spend
        // the certificate twice.
        clientSaleId: saleIdRef.current ?? undefined,
        customerName: customer.name.trim() || undefined,
        customerEmail: customer.email.trim() || undefined,
        customerPhone: customer.phone.trim() || undefined,
      })
      if (!res.ok) {
        setError(res.error)
        if (res.soldOutVariantId) {
          setSoldOutId(res.soldOutVariantId)
          setTenderOpen(false)
          setCartSheetOpen(true)
        }
        return
      }
      setDone({
        orderNumber: res.orderNumber,
        totalCents: res.totalCents,
        changeCents: res.changeCents,
        giftCardCents: res.giftCardCents,
        issuedGiftCards: res.issuedGiftCards,
        email: customer.email.trim(),
      })
      saleIdRef.current = null
      setTenderOpen(false)
      setCartSheetOpen(false)
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* noop */
      }
    } catch {
      setError('Could not complete the sale. Nothing was charged — try again.')
    } finally {
      setBusy(false)
      submittingRef.current = false
    }
  }

  function newSale() {
    setCart({})
    setDiscount(null)
    setGiftCards([])
    setRedeemCard(null)
    saleIdRef.current = null
    setCustomer({ name: '', email: '', phone: '' })
    setSearch('')
    setCategory('All')
    setDone(null)
    setError(null)
    setSoldOutId(null)
    router.refresh()
  }

  async function toggleHideOOS(next: boolean) {
    setHideOOS(next)
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posHideOutOfStock: next }),
      })
    } catch {
      /* non-fatal */
    }
  }

  // ── Success screen ──
  if (done) {
    return (
      <div className="card mx-auto max-w-md py-10 text-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-xl font-bold text-brand-dark">Sale complete</h2>
        <p className="mt-1 text-sm text-brand-brown/60">
          Order #{done.orderNumber} · {money(done.totalCents)} · stock updated
        </p>
        {done.giftCardCents > 0 && (
          <p className="mt-1 text-sm text-brand-brown/60">
            {money(done.giftCardCents)} paid by gift certificate
          </p>
        )}
        {done.changeCents > 0 && (
          <div className="mx-auto mt-4 w-fit rounded-lg bg-green-100 px-6 py-3">
            <div className="text-xs text-brand-brown/60">Change due</div>
            <div className="font-display text-3xl font-bold tabular-nums text-green-700">{money(done.changeCents)}</div>
          </div>
        )}

        {/* Certificates just sold — the customer leaves with nothing until
            these are printed, so make that the obvious next tap. */}
        {done.issuedGiftCards.length > 0 && (
          <div className="mt-4 rounded-lg border border-brand-warm/60 bg-white p-3 text-left">
            <div className="text-xs font-medium text-brand-brown/80">
              {done.issuedGiftCards.length === 1
                ? 'Certificate sold — print it for the customer'
                : `${done.issuedGiftCards.length} certificates sold — print them for the customer`}
            </div>
            <div className="mt-2 space-y-2">
              {done.issuedGiftCards.map((g) => (
                <div key={g.id} className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-brand-dark">
                    {g.code.replace(/^(.{4})(.{4})(.*)$/, 'SM-$1-$2-$3')}
                  </span>
                  <span className="text-xs tabular-nums text-brand-brown/60">
                    {money(g.amountCents)}
                  </span>
                  <a
                    href={`/admin/gift-cards/${g.id}/print`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-1 text-xs"
                  >
                    Print
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {done.email && <p className="mt-3 text-xs text-brand-brown/50">Receipt queued for {done.email}</p>}
        <button onClick={newSale} className="btn-primary mt-6 h-12 px-8">
          Next customer
        </button>
      </div>
    )
  }

  const catalog = (
    <div className="min-w-0">
      {/* Sticky search + categories */}
      <div className="sticky top-0 z-10 -mx-1 mb-3 bg-surface-warm/95 px-1 pb-2 pt-1 backdrop-blur">
        <div className="mb-2 flex items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, scents…"
            className="input h-11 flex-1 text-base"
          />
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-brand-brown/80">
            <input type="checkbox" checked={hideOOS} onChange={(e) => toggleHideOOS(e.target.checked)} className="h-4 w-4 rounded border-brand-warm text-brand-terra focus:ring-brand-terra" />
            Hide OOS
          </label>
        </div>
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium ${category === c ? 'bg-brand-terra text-white' : 'bg-brand-warm/50 text-brand-brown'}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-brand-brown/50">
          {search ? `No products match “${search}”.` : 'No products to show.'}
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.productId}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="font-display text-base font-semibold text-brand-dark">{g.product}</h3>
                {g.category && <span className="text-[11px] uppercase tracking-wide text-brand-brown/40">{g.category}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {g.sizes.map((sg) => (
                  <div key={sg.size || '_'} className="contents">
                    {sg.size && (
                      <div className="col-span-full text-xs font-medium uppercase tracking-wide text-brand-brown/50">
                        {sg.size}
                      </div>
                    )}
                    {sg.variants.map((v) => {
                      const inCart = cart[v.id] ?? 0
                      const out = v.stock <= 0
                      const atCap = inCart >= v.stock
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => add(v)}
                          disabled={out || atCap}
                          className={`relative flex min-h-[72px] flex-col justify-between rounded-xl border p-3 text-left transition-transform active:scale-[0.98] ${
                            out
                              ? 'border-brand-warm/40 bg-surface-muted opacity-50'
                              : inCart > 0
                                ? 'border-brand-terra bg-brand-peach/20 ring-1 ring-brand-terra/40'
                                : 'border-brand-warm/60 bg-white hover:border-brand-terra'
                          }`}
                        >
                          {inCart > 0 && (
                            <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-terra px-1 text-xs font-bold text-white">
                              {inCart}
                            </span>
                          )}
                          <div className="text-sm font-medium leading-tight text-brand-dark line-clamp-2">
                            {v.scent || 'Standard'}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-brand-terra">{money(v.priceCents)}</span>
                            <span className={out ? 'text-red-500' : atCap ? 'text-brand-brown/40' : v.stock <= 5 ? 'font-medium text-amber-600' : 'text-brand-brown/40'}>
                              {out ? 'out' : atCap ? 'max' : `${v.stock} left`}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_19rem] lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_24rem]">
      {catalog}

      {/* Persistent rail (md+) */}
      <aside className="hidden self-start md:sticky md:top-4 md:flex md:max-h-[calc(100dvh-2rem)] md:flex-col">
        <div className="card flex max-h-full flex-col">
          <CartPanel
            lines={lines}
            subtotal={subtotal}
            discount={discount}
            setDiscount={setDiscount}
            discountCents={discountCents}
            taxable={taxable}
            setTaxable={setTaxable}
            taxRate={taxRate}
            total={total}
            giftCards={giftCards}
            onAddGiftCard={addGiftCard}
            onRemoveGiftCard={removeGiftCard}
            customer={customer}
            setCustomer={setCustomer}
            onQty={setQty}
            onRemove={removeLine}
            onClear={clearCart}
            onCharge={openTender}
            soldOutId={soldOutId}
            error={error}
          />
        </div>
      </aside>

      {/* Mobile: bottom bar → cart sheet */}
      {(lines.length > 0 || giftCards.length > 0) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-warm/60 bg-white/95 px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
          <button onClick={() => setCartSheetOpen(true)} className="btn-primary flex w-full items-center justify-center gap-2 py-3">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold">
              {lines.reduce((n, l) => n + l.qty, 0) + giftCards.length}
            </span>
            View sale · {money(total)}
          </button>
        </div>
      )}

      {cartSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface-warm md:hidden">
          <div className="flex-1 overflow-hidden p-4">
            <CartPanel
              lines={lines}
              subtotal={subtotal}
              discount={discount}
              setDiscount={setDiscount}
              discountCents={discountCents}
              taxable={taxable}
              setTaxable={setTaxable}
              taxRate={taxRate}
              total={total}
              giftCards={giftCards}
              onAddGiftCard={addGiftCard}
              onRemoveGiftCard={removeGiftCard}
              customer={customer}
              setCustomer={setCustomer}
              onQty={setQty}
              onRemove={removeLine}
              onClear={clearCart}
              onCharge={openTender}
              soldOutId={soldOutId}
              error={error}
              onClose={() => setCartSheetOpen(false)}
            />
          </div>
        </div>
      )}

      {tenderOpen && (
        <TenderSheet
          totalCents={total}
          giftCard={appliedGiftCard}
          giftCardMaxCents={redeemableCents}
          onApplyGiftCard={setRedeemCard}
          onRemoveGiftCard={() => setRedeemCard(null)}
          busy={busy}
          error={error}
          onCancel={() => { setTenderOpen(false); setError(null) }}
          onComplete={submit}
        />
      )}
    </div>
  )
}
