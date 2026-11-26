'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { recordBlankSales, type BlankSaleRow } from '@/app/lib/actions/gift-cards'

interface Card {
  id: string
  code: string
  formattedCode: string
  last4: string
  status: string
  initialCents: number
  recipientName: string | null
  purchaserName: string | null
  issuedAt: string | null
}

interface Draft {
  amount: string
  paidWith: string
  soldOn: string
  to: string
  from: string
  spoiled: boolean
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

/** Split "SM-AZZ4-4GE7-7AX" so the last 4 code characters can be bolded —
 *  they can straddle a hyphen, so count characters rather than slicing. */
function splitLast4(formatted: string): [string, string] {
  let seen = 0
  let i = formatted.length
  while (i > 0 && seen < 4) {
    i--
    if (formatted[i] !== '-') seen++
  }
  return [formatted.slice(0, i), formatted.slice(i)]
}

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * One row per certificate in the batch. Mel works through her stubs: type the
 * amount on each one that sold, leave the rest empty (they stay blank and can
 * be sold another day), tick "spoiled" for any she wrote on by mistake.
 */
export default function BlankEntry({
  cards,
  paidWithOptions,
}: {
  cards: Card[]
  paidWithOptions: string[]
}) {
  const router = useRouter()
  const [soldOnAll, setSoldOnAll] = useState(todayLocal())
  const [paidWithAll, setPaidWithAll] = useState(paidWithOptions[0])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ sold: number; cents: number; spoiled: number } | null>(
    null,
  )
  const [showDone, setShowDone] = useState(false)

  const blanks = cards.filter((c) => c.status === 'UNISSUED')
  const done = cards.filter((c) => c.status !== 'UNISSUED')

  function draftFor(id: string): Draft {
    return (
      drafts[id] ?? {
        amount: '',
        paidWith: paidWithAll,
        soldOn: soldOnAll,
        to: '',
        from: '',
        spoiled: false,
      }
    )
  }

  function patch(id: string, p: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(id), ...p } }))
    setRowErrors((e) => {
      if (!e[id]) return e
      const next = { ...e }
      delete next[id]
      return next
    })
  }

  /** Changing the shared date/method updates every row Mel hasn't overridden. */
  function setAll(field: 'soldOn' | 'paidWith', value: string) {
    const prev = field === 'soldOn' ? soldOnAll : paidWithAll
    if (field === 'soldOn') setSoldOnAll(value)
    else setPaidWithAll(value)
    setDrafts((d) => {
      const next: Record<string, Draft> = {}
      for (const [id, dr] of Object.entries(d)) {
        next[id] = dr[field] === prev ? { ...dr, [field]: value } : dr
      }
      return next
    })
  }

  const pending = useMemo(() => {
    const rows: BlankSaleRow[] = []
    const bad: Record<string, string> = {}
    let cents = 0
    for (const c of blanks) {
      const d = drafts[c.id]
      if (!d) continue
      if (d.spoiled) {
        rows.push({ cardId: c.id, kind: 'spoiled' })
        continue
      }
      if (!d.amount.trim()) continue
      const dollars = Number(d.amount.replace(/[$,\s]/g, ''))
      if (!Number.isFinite(dollars) || dollars <= 0) {
        bad[c.id] = 'Amount?'
        continue
      }
      const amountCents = Math.round(dollars * 100)
      cents += amountCents
      rows.push({
        cardId: c.id,
        kind: 'sold',
        amountCents,
        paidWith: d.paidWith,
        soldOn: d.soldOn,
        recipientName: d.to,
        purchaserName: d.from,
      })
    }
    return { rows, bad, cents }
  }, [blanks, drafts])

  const soldCount = pending.rows.filter((r) => r.kind === 'sold').length
  const spoiledCount = pending.rows.length - soldCount

  async function save() {
    setError(null)
    setSaved(null)
    if (Object.keys(pending.bad).length > 0) {
      setRowErrors(pending.bad)
      setError('Some amounts don’t look right — check the highlighted rows.')
      return
    }
    if (pending.rows.length === 0) {
      setError('Type an amount on each certificate you sold first.')
      return
    }
    if (
      spoiledCount > 0 &&
      !confirm(
        `Void ${spoiledCount} spoiled blank${spoiledCount === 1 ? '' : 's'}? They can never be sold after this.`,
      )
    ) {
      return
    }
    setBusy(true)
    const res = await recordBlankSales(pending.rows)
    setBusy(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    const failed: Record<string, string> = {}
    let okSold = 0
    let okCents = 0
    let okSpoiled = 0
    for (const r of res.results) {
      if (!r.ok) {
        failed[r.cardId] = r.error ?? 'Not saved'
        continue
      }
      const row = pending.rows.find((p) => p.cardId === r.cardId)
      if (row?.kind === 'sold') {
        okSold++
        okCents += row.amountCents
      } else okSpoiled++
    }
    // Keep only the failed rows' drafts so Mel can fix and resubmit them.
    setDrafts((d) => {
      const next: Record<string, Draft> = {}
      for (const id of Object.keys(failed)) if (d[id]) next[id] = d[id]
      return next
    })
    setRowErrors(failed)
    setSaved({ sold: okSold, cents: okCents, spoiled: okSpoiled })
    if (Object.keys(failed).length > 0) {
      setError(`${Object.keys(failed).length} didn’t save — see the rows marked in red.`)
    }
    router.refresh()
  }

  return (
    <div>
      {saved && (saved.sold > 0 || saved.spoiled > 0) && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {[
            saved.sold > 0 &&
              `Saved ${saved.sold} sale${saved.sold === 1 ? '' : 's'} (${money(saved.cents)}) — those certificates are live now and the money shows in Reports on the day sold.`,
            saved.spoiled > 0 &&
              `Voided ${saved.spoiled} spoiled blank${saved.spoiled === 1 ? '' : 's'}.`,
          ]
            .filter(Boolean)
            .join(' ')}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {blanks.length === 0 ? (
        <div className="card py-10 text-center text-brand-brown/60">
          Every certificate in this batch has been entered.
        </div>
      ) : (
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Enter what you sold
          </h2>
          <p className="mt-1 text-xs text-brand-brown/60">
            Go through your stubs and type the amount on each one you sold. Leave unsold ones empty
            — they stay blank for next time. Match by the last 4 characters of the number.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-4 rounded-lg bg-brand-cream/60 p-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-brown/70">
                Sold on (all rows)
              </span>
              <input
                type="date"
                value={soldOnAll}
                max={todayLocal()}
                onChange={(e) => setAll('soldOn', e.target.value)}
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-brand-brown/70">
                Paid with (all rows)
              </span>
              <select
                value={paidWithAll}
                onChange={(e) => setAll('paidWith', e.target.value)}
                className="input"
              >
                {paidWithOptions.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <p className="pb-2 text-xs text-brand-brown/50">
              You can still change any single row below.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
                <tr>
                  <th className="px-2 py-2">Number</th>
                  <th className="px-2 py-2">Amount</th>
                  <th className="px-2 py-2">Paid with</th>
                  <th className="px-2 py-2">Sold on</th>
                  <th className="px-2 py-2">To</th>
                  <th className="px-2 py-2">From</th>
                  <th className="px-2 py-2 text-center">Spoiled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-warm/40">
                {blanks.map((c) => {
                  const d = draftFor(c.id)
                  const err = rowErrors[c.id]
                  return (
                    <tr key={c.id} className={err ? 'bg-red-50' : d.spoiled ? 'opacity-50' : ''}>
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-brand-brown/70">
                        {splitLast4(c.formattedCode)[0]}
                        <strong className="text-sm text-brand-dark">
                          {splitLast4(c.formattedCode)[1]}
                        </strong>
                        {err && <div className="mt-0.5 font-sans text-xs text-red-700">{err}</div>}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={d.amount}
                          disabled={d.spoiled}
                          onChange={(e) => patch(c.id, { amount: e.target.value })}
                          inputMode="decimal"
                          placeholder="$"
                          aria-label={`Amount for ${c.formattedCode}`}
                          className="input w-24"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={d.paidWith}
                          disabled={d.spoiled}
                          onChange={(e) => patch(c.id, { paidWith: e.target.value })}
                          aria-label={`Paid with for ${c.formattedCode}`}
                          className="input w-28"
                        >
                          {paidWithOptions.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="date"
                          value={d.soldOn}
                          max={todayLocal()}
                          disabled={d.spoiled}
                          onChange={(e) => patch(c.id, { soldOn: e.target.value })}
                          aria-label={`Sold on for ${c.formattedCode}`}
                          className="input w-40"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={d.to}
                          disabled={d.spoiled}
                          onChange={(e) => patch(c.id, { to: e.target.value })}
                          placeholder="optional"
                          aria-label={`Recipient for ${c.formattedCode}`}
                          className="input w-32"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={d.from}
                          disabled={d.spoiled}
                          onChange={(e) => patch(c.id, { from: e.target.value })}
                          placeholder="optional"
                          aria-label={`Purchaser for ${c.formattedCode}`}
                          className="input w-32"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={d.spoiled}
                          onChange={(e) => patch(c.id, { spoiled: e.target.checked })}
                          aria-label={`Mark ${c.formattedCode} spoiled`}
                          className="h-4 w-4"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-warm/40 pt-4">
            <div className="text-sm text-brand-brown/80">
              {soldCount > 0 ? (
                <>
                  <strong>{soldCount}</strong> sold · <strong>{money(pending.cents)}</strong> taken
                  in
                </>
              ) : (
                'Nothing entered yet.'
              )}
              {spoiledCount > 0 && <> · {spoiledCount} spoiled</>}
            </div>
            <button
              onClick={save}
              disabled={busy || pending.rows.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowDone((s) => !s)}
            className="text-sm font-medium text-brand-terra hover:underline"
          >
            {showDone ? 'Hide' : 'Show'} {done.length} already entered
          </button>
          {showDone && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-brand-warm/60">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-brand-warm/40 bg-white">
                  {done.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/gift-cards/${c.id}`}
                          className="font-mono text-xs text-brand-dark hover:text-brand-terra"
                        >
                          {c.formattedCode}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-brand-brown/80">
                        {c.status === 'VOID' ? 'Voided' : money(c.initialCents)}
                      </td>
                      <td className="px-4 py-2 text-brand-brown/70">
                        {[c.recipientName, c.purchaserName].filter(Boolean).join(' ← ') || '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-brand-brown/50">
                        {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
