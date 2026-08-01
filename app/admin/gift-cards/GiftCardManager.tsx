'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBlankBatch, issueGiftCard } from '@/app/lib/actions/gift-cards'

interface CardRow {
  id: string
  code: string
  formattedCode: string
  status: string
  initialCents: number
  balanceCents: number
  recipientName: string | null
  purchaserName: string | null
  issueReason: string
  issuedAt: string | null
  createdAt: string
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_STYLE: Record<string, string> = {
  UNISSUED: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
  VOID: 'bg-red-100 text-red-700',
}

const PRESETS = [1000, 2000, 2500, 5000]

export default function GiftCardManager({
  cards,
  outstandingCents,
  redeemedCents,
}: {
  cards: CardRow[]
  outstandingCents: number
  redeemedCents: number
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UNISSUED' | 'VOID'>('ALL')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ code: string; id: string } | null>(null)

  // Issue form
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [purchaser, setPurchaser] = useState('')
  const [message, setMessage] = useState('')
  const [batchCount, setBatchCount] = useState('10')

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    return cards.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false
      if (!q) return true
      // Match a full or partial code, or a name — Mel often has only the last
      // few characters off a torn certificate.
      return (
        c.code.includes(q) ||
        (c.recipientName ?? '').toUpperCase().includes(search.trim().toUpperCase()) ||
        (c.purchaserName ?? '').toUpperCase().includes(search.trim().toUpperCase())
      )
    })
  }, [cards, search, statusFilter])

  async function submitIssue() {
    setError(null)
    const dollars = parseFloat(amount)
    if (isNaN(dollars) || dollars <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    setBusy(true)
    const res = await issueGiftCard({
      amountCents: Math.round(dollars * 100),
      issueReason: 'MANUAL',
      recipientName: recipient,
      purchaserName: purchaser,
      giftMessage: message,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setIssued({ code: res.code, id: res.id })
    setAmount('')
    setRecipient('')
    setPurchaser('')
    setMessage('')
    router.refresh()
  }

  async function submitBatch() {
    setError(null)
    setBusy(true)
    const res = await createBlankBatch(parseInt(batchCount, 10))
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold text-brand-dark">Gift Certificates</h1>
      </div>

      {/* Liability summary. Selling a certificate isn't revenue — it's a
          promise of goods — so this is what's still owed. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-brand-brown/60">Outstanding</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-dark tabular-nums">
            {money(outstandingCents)}
          </div>
          <p className="mt-1 text-xs text-brand-brown/50">Goods still owed, not income yet.</p>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-brand-brown/60">Redeemed</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-dark tabular-nums">
            {money(redeemedCents)}
          </div>
          <p className="mt-1 text-xs text-brand-brown/50">Spent so far, all time.</p>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-brand-brown/60">Live cards</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-dark tabular-nums">
            {cards.filter((c) => c.status === 'ACTIVE').length}
          </div>
          <p className="mt-1 text-xs text-brand-brown/50">Active certificates with a code.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {issued && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-800">
            Certificate created:{' '}
            <span className="font-mono text-base font-bold tracking-wide">
              {issued.code.replace(/^(.{4})(.{4})(.*)$/, 'SM-$1-$2-$3')}
            </span>
          </p>
          <div className="mt-2 flex gap-3">
            <Link href={`/admin/gift-cards/${issued.id}/print`} className="btn-primary text-sm">
              Print it
            </Link>
            <button onClick={() => setIssued(null)} className="btn-ghost text-sm">
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Issue one */}
        <div className="card lg:col-span-2">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Issue a certificate
          </h2>
          <p className="mt-1 text-xs text-brand-brown/60">
            Creates an active certificate with a code on it. For one sold at a market, ring it up
            on the New Sale screen instead so the money lands in the day&apos;s takings.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount((p / 100).toString())}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  amount === (p / 100).toString()
                    ? 'border-brand-terra bg-brand-terra text-white'
                    : 'border-brand-warm text-brand-brown hover:border-brand-terra'
                }`}
              >
                {money(p)}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-brown/70">Amount</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="25.00"
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-brown/70">
                For (optional)
              </span>
              <input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Recipient"
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-brown/70">
                From (optional)
              </span>
              <input
                value={purchaser}
                onChange={(e) => setPurchaser(e.target.value)}
                placeholder="Purchaser"
                className="input"
              />
            </label>
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-medium text-brand-brown/70">
              Message (optional, prints on the certificate)
            </span>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Happy birthday!"
              className="input"
            />
          </label>

          <button onClick={submitIssue} disabled={busy} className="btn-primary mt-4 disabled:opacity-50">
            {busy ? 'Working…' : 'Issue certificate'}
          </button>
        </div>

        {/* Blanks */}
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-brand-dark">Print blanks</h2>
          <p className="mt-1 text-xs text-brand-brown/60">
            Numbered certificates with no money on them, to fill in by hand at a market. A blank
            is worthless until you activate it, so a lost stack costs paper, not cash.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={batchCount}
              onChange={(e) => setBatchCount(e.target.value)}
              inputMode="numeric"
              className="input w-24"
            />
            <button onClick={submitBatch} disabled={busy} className="btn-secondary disabled:opacity-50">
              Create
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code or name…"
          className="input max-w-xs"
        />
        {(['ALL', 'ACTIVE', 'UNISSUED', 'VOID'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-terra text-white'
                : 'bg-brand-cream text-brand-brown hover:bg-brand-warm'
            }`}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card py-12 text-center text-brand-brown/60">
          {cards.length === 0
            ? 'No certificates yet. Issue one above, or print a run of blanks.'
            : 'Nothing matches that search.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-warm/60">
          <table className="w-full text-sm">
            <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">For</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-warm/40 bg-white">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/gift-cards/${c.id}`}
                      className="font-mono text-xs font-medium text-brand-dark hover:text-brand-terra"
                    >
                      {c.formattedCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-brown/80">{c.recipientName || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-brand-brown/70">
                    {c.status === 'UNISSUED' ? '—' : money(c.initialCents)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-brand-dark">
                    {c.status === 'UNISSUED' ? '—' : money(c.balanceCents)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[c.status] ?? ''
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-brand-brown/50">
                    {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
