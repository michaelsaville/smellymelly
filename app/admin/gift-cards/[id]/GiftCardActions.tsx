'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  activateBlank,
  adjustGiftCard,
  reloadGiftCard,
  updateGiftCardNotes,
  voidGiftCard,
} from '@/app/lib/actions/gift-cards'

type Panel = 'activate' | 'reload' | 'adjust' | 'void' | null

export default function GiftCardActions({
  cardId,
  status,
  balanceCents,
  notes,
}: {
  cardId: string
  status: string
  balanceCents: number
  notes: string
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [recipient, setRecipient] = useState('')
  const [purchaser, setPurchaser] = useState('')
  const [noteText, setNoteText] = useState(notes)
  const [noteSaved, setNoteSaved] = useState(false)

  function reset() {
    setPanel(null)
    setAmount('')
    setReason('')
    setRecipient('')
    setPurchaser('')
    setError(null)
  }

  function dollarsToCents(): number | null {
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) return null
    return Math.round(n * 100)
  }

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong.')
      return
    }
    reset()
    router.refresh()
  }

  async function saveNote() {
    setBusy(true)
    const res = await updateGiftCardNotes(cardId, noteText)
    setBusy(false)
    if (res.ok) {
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
      router.refresh()
    } else {
      setError(res.error)
    }
  }

  const isVoid = status === 'VOID'
  const isBlank = status === 'UNISSUED'

  return (
    <div className="card">
      <h2 className="font-display text-lg font-semibold text-brand-dark">Manage</h2>

      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {isVoid ? (
        <p className="mt-2 text-sm text-brand-brown/60">
          This certificate was voided. Voiding is permanent — issue a new one instead.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {isBlank ? (
            <button onClick={() => setPanel('activate')} className="btn-primary text-sm">
              Activate this blank
            </button>
          ) : (
            <>
              <button onClick={() => setPanel('reload')} className="btn-secondary text-sm">
                Add value
              </button>
              <button onClick={() => setPanel('adjust')} className="btn-ghost text-sm">
                Correct balance
              </button>
            </>
          )}
          <button
            onClick={() => setPanel('void')}
            className="btn-ghost text-sm text-red-600 hover:bg-red-50"
          >
            Void
          </button>
        </div>
      )}

      {panel === 'activate' && (
        <div className="mt-4 rounded-lg border border-brand-warm/60 bg-surface-muted p-4">
          <p className="text-xs text-brand-brown/70">
            Put money on this printed blank. Its number stays the same.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Amount, e.g. 25.00"
              className="input"
            />
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="For (optional)"
              className="input"
            />
            <input
              value={purchaser}
              onChange={(e) => setPurchaser(e.target.value)}
              placeholder="From (optional)"
              className="input"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() => {
                const cents = dollarsToCents()
                if (cents === null) return setError('Enter an amount greater than zero.')
                run(() =>
                  activateBlank({
                    cardId,
                    amountCents: cents,
                    recipientName: recipient,
                    purchaserName: purchaser,
                  }),
                )
              }}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Activate
            </button>
            <button onClick={reset} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {panel === 'reload' && (
        <div className="mt-4 rounded-lg border border-brand-warm/60 bg-surface-muted p-4">
          <p className="text-xs text-brand-brown/70">
            Add money to this certificate — a top-up the customer paid for.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="25.00"
              className="input max-w-[10rem]"
            />
            <button
              disabled={busy}
              onClick={() => {
                const cents = dollarsToCents()
                if (cents === null) return setError('Enter an amount greater than zero.')
                run(() => reloadGiftCard(cardId, cents))
              }}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Add
            </button>
            <button onClick={reset} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {panel === 'adjust' && (
        <div className="mt-4 rounded-lg border border-brand-warm/60 bg-surface-muted p-4">
          <p className="text-xs text-brand-brown/70">
            Fix a mistake. Use a minus sign to take money off, e.g. −5.00. The reason is recorded
            in the history permanently.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr]">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="text"
              placeholder="-5.00"
              className="input"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? (required)"
              className="input"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() => {
                const n = parseFloat(amount)
                if (isNaN(n) || n === 0) return setError('Enter an amount.')
                if (!reason.trim()) return setError('A reason is required.')
                run(() => adjustGiftCard(cardId, Math.round(n * 100), reason))
              }}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Apply correction
            </button>
            <button onClick={reset} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {panel === 'void' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Void this certificate{balanceCents > 0 && ` and wipe its $${(balanceCents / 100).toFixed(2)} balance`}?
          </p>
          <p className="mt-1 text-xs text-red-700">
            It can never be redeemed or reactivated. Use this for a lost or stolen certificate,
            then issue a replacement.
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why? (required)"
            className="input mt-3"
          />
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() => {
                if (!reason.trim()) return setError('A reason is required.')
                run(() => voidGiftCard(cardId, reason))
              }}
              className="inline-flex items-center justify-center rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Void it
            </button>
            <button onClick={reset} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notes — free-form, always available. */}
      <div className="mt-5 border-t border-brand-warm/40 pt-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-brand-brown/70">
            Notes (private)
          </span>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            placeholder="Reissued for Katie, original lost…"
            className="input"
          />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={saveNote}
            disabled={busy || noteText === notes}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            Save note
          </button>
          {noteSaved && <span className="text-xs text-green-700">Saved ✓</span>}
        </div>
      </div>
    </div>
  )
}
