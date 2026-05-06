'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

interface ScentRef {
  id: string
  name: string
}

interface VariantRef {
  id: string
  name: string
  productName: string
  productSlug: string
}

interface UnmatchedRow {
  key: string
  display: string
  variants: VariantRef[]
  suggestion: ScentRef | null
}

interface MatchedRow {
  key: string
  display: string
  canonicalName: string
  source: 'direct' | 'alias'
  variantCount: number
}

interface AliasRow {
  id: string
  alias: string
  scentId: string
  scentName: string
}

export function VariantMapManager({
  scents,
  unmatched,
  matched,
  aliases,
}: {
  scents: ScentRef[]
  unmatched: UnmatchedRow[]
  matched: MatchedRow[]
  aliases: AliasRow[]
}) {
  return (
    <div className="mt-6 space-y-8">
      <Section
        title={`Unmatched variant scents (${unmatched.length})`}
        subtitle="These scent prefixes appear on a product variant but don't resolve to an SM_Scent. Map each one to fix the customer-facing description on the sales page."
      >
        {unmatched.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-brown/60">
            All variant scents resolve. Nothing to map.
          </p>
        ) : (
          <div className="divide-y divide-brand-brown/10">
            {unmatched.map((row) => (
              <UnmatchedRowEditor key={row.key} row={row} scents={scents} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Existing aliases (${aliases.length})`}
        subtitle="Variant scent strings that have been mapped to a canonical SM_Scent. Delete to undo."
      >
        {aliases.length === 0 ? (
          <p className="px-4 py-6 text-sm text-brand-brown/60">
            No aliases yet.
          </p>
        ) : (
          <div className="divide-y divide-brand-brown/10">
            {aliases.map((a) => (
              <AliasRowEditor key={a.id} alias={a} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Matched variant scents (${matched.length})`}
        subtitle="Already resolving cleanly. Listed for reference only."
        collapsedByDefault
      >
        <table className="w-full text-sm">
          <thead className="bg-brand-cream/40 text-left text-xs uppercase tracking-wide text-brand-brown/60">
            <tr>
              <th className="px-4 py-2">Variant scent</th>
              <th className="px-4 py-2">Resolves to</th>
              <th className="px-4 py-2">Match</th>
              <th className="px-4 py-2 text-right">Variants</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-brown/10">
            {matched.map((m) => (
              <tr key={m.key}>
                <td className="px-4 py-2 font-medium text-brand-dark">
                  {m.display}
                </td>
                <td className="px-4 py-2 text-brand-brown/80">
                  {m.canonicalName}
                </td>
                <td className="px-4 py-2 text-xs text-brand-brown/60">
                  {m.source === 'direct' ? 'direct' : 'via alias'}
                </td>
                <td className="px-4 py-2 text-right text-xs text-brand-brown/60">
                  {m.variantCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
  collapsedByDefault,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  collapsedByDefault?: boolean
}) {
  const [open, setOpen] = useState(!collapsedByDefault)
  return (
    <section className="rounded-lg border border-brand-brown/15 bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-brand-brown/10 px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-brand-brown/60">{subtitle}</p>
          )}
        </div>
        {collapsedByDefault && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-brand-brown/60 hover:text-brand-terra"
          >
            {open ? 'hide' : 'show'}
          </button>
        )}
      </header>
      {open && children}
    </section>
  )
}

function UnmatchedRowEditor({
  row,
  scents,
}: {
  row: UnmatchedRow
  scents: ScentRef[]
}) {
  const router = useRouter()
  const [scentId, setScentId] = useState(row.suggestion?.id ?? '')
  const [newName, setNewName] = useState(row.display)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const sortedScents = useMemo(
    () => [...scents].sort((a, b) => a.name.localeCompare(b.name)),
    [scents],
  )

  async function mapToExisting() {
    if (!scentId) {
      setErr('Pick a scent first.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/scents/variant-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: row.display, scentId }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) throw new Error(j?.error ?? `Failed (${res.status})`)
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  async function addAsNewScent() {
    const name = newName.trim()
    if (!name) {
      setErr('Name is required.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/scents/variant-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: row.display, newScentName: name }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) throw new Error(j?.error ?? `Failed (${res.status})`)
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <div>
          <div className="font-display text-sm font-semibold text-brand-dark">
            {row.display}
          </div>
          <div className="mt-1 text-[11px] text-brand-brown/60">
            {row.variants.length} variant{row.variants.length === 1 ? '' : 's'}:{' '}
            {row.variants
              .slice(0, 3)
              .map((v) => `${v.productName} — ${v.name}`)
              .join('; ')}
            {row.variants.length > 3 && ` (+${row.variants.length - 3})`}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scentId}
              onChange={(e) => setScentId(e.target.value)}
              className="input flex-1 text-sm"
              disabled={busy}
            >
              <option value="">— pick existing scent —</option>
              {sortedScents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {row.suggestion && s.id === row.suggestion.id ? ' (closest)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={mapToExisting}
              disabled={busy || !scentId}
              className="rounded-md border border-brand-warm bg-white px-3 py-1.5 text-xs font-medium text-brand-dark hover:border-brand-terra disabled:opacity-50"
            >
              Map
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New scent name"
              className="input flex-1 text-sm"
              disabled={busy}
            />
            <button
              type="button"
              onClick={addAsNewScent}
              disabled={busy || !newName.trim()}
              className="rounded-md border border-brand-warm bg-white px-3 py-1.5 text-xs font-medium text-brand-dark hover:border-brand-terra disabled:opacity-50"
              title="Adds an SM_Scent. Generate its description from /admin/scents/descriptions."
            >
              Add as new
            </button>
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      </div>
    </div>
  )
}

function AliasRowEditor({ alias }: { alias: AliasRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function remove() {
    if (
      !confirm(
        `Delete alias "${alias.alias}" → "${alias.scentName}"? Variants matching "${alias.alias}" will stop showing this scent's description.`,
      )
    ) {
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/admin/scents/variant-map/${alias.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `Failed (${res.status})`)
      }
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <div className="text-sm">
        <span className="font-medium text-brand-dark">{alias.alias}</span>
        <span className="mx-2 text-brand-brown/40">→</span>
        <span className="text-brand-brown/80">{alias.scentName}</span>
      </div>
      <div className="flex items-center gap-2">
        {err && <span className="text-xs text-red-600">{err}</span>}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-md border border-brand-warm bg-white px-2.5 py-1 text-xs text-brand-brown/70 hover:border-red-400 hover:text-red-600 disabled:opacity-50"
        >
          {busy ? '…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
