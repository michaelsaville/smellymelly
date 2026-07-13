'use client'

import { useState } from 'react'
import Link from 'next/link'
import StoreLayout from '@/app/components/StoreLayout'
import { QUIZ } from '@/app/lib/scent-families'

type Rec = {
  scent: string
  description: string | null
  productSlug: string
  productName: string
  families: string[]
}

export default function ScentFinderPage() {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [recs, setRecs] = useState<Rec[] | null>(null)
  const [error, setError] = useState('')

  const allAnswered = QUIZ.every((q) => answers[q.id] !== undefined)

  async function findScents() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/scent-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setRecs(data.recommendations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setAnswers({})
    setRecs(null)
    setError('')
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-brand-dark">Find your scent</h1>
          <p className="text-brand-brown/70 mt-2 text-sm">
            Answer three quick questions and we&apos;ll match you with scents you&apos;ll love.
          </p>
        </div>

        {recs === null ? (
          <div className="space-y-6">
            {QUIZ.map((q) => (
              <div key={q.id} className="card">
                <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">{q.question}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, i) => {
                    const selected = answers[q.id] === i
                    return (
                      <button
                        key={i}
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors min-h-[44px] ${
                          selected
                            ? 'border-brand-terra bg-brand-terra/10 text-brand-dark font-medium'
                            : 'border-brand-warm/60 hover:bg-brand-warm/20 text-brand-brown'
                        }`}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            <button
              onClick={findScents}
              disabled={!allAnswered || loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Finding your scents…' : 'Find my scents 🌸'}
            </button>
          </div>
        ) : (
          <div>
            {recs.length === 0 ? (
              <div className="card text-center">
                <p className="text-brand-brown mb-4">
                  We couldn&apos;t find a perfect match from those answers — but there&apos;s plenty to
                  explore!
                </p>
                <Link href="/shop" className="btn-primary">Browse all scents</Link>
              </div>
            ) : (
              <>
                <p className="text-center text-brand-brown/70 mb-5 text-sm">
                  Based on your answers, we think you&apos;ll love these:
                </p>
                <div className="space-y-3">
                  {recs.map((r) => (
                    <Link
                      key={r.scent + r.productSlug}
                      href={`/shop/${r.productSlug}?scent=${encodeURIComponent(r.scent)}`}
                      className="card block hover:ring-1 hover:ring-brand-terra/40 transition"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg font-semibold text-brand-terra">{r.scent}</h3>
                          {r.description && (
                            <p className="text-sm text-brand-brown/70 mt-0.5 line-clamp-2">{r.description}</p>
                          )}
                          <p className="text-xs text-brand-brown/50 mt-1">Try it in {r.productName} →</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
            <div className="text-center mt-6">
              <button onClick={reset} className="text-sm text-brand-terra hover:underline">
                ↺ Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  )
}
