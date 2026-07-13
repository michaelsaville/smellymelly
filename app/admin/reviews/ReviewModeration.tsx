'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Stars from '@/app/components/Stars'
import { setReviewApproved, deleteReview } from '@/app/lib/actions/reviews'

type Row = {
  id: string
  productName: string
  authorName: string
  rating: number
  title: string | null
  body: string
  isApproved: boolean
  createdAt: string
}

export default function ReviewModeration({ reviews }: { reviews: Row[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function approve(id: string, val: boolean) {
    setBusy(id)
    await setReviewApproved(id, val)
    setBusy(null)
    router.refresh()
  }
  async function remove(id: string) {
    if (!confirm('Delete this review permanently?')) return
    setBusy(id)
    await deleteReview(id)
    setBusy(null)
    router.refresh()
  }

  if (reviews.length === 0) {
    return <div className="card text-center py-12 text-brand-brown/60">No reviews yet.</div>
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div
          key={r.id}
          className={`card ${!r.isApproved ? 'border-amber-300 bg-amber-50/40' : ''}`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2">
                <Stars rating={r.rating} className="text-sm" />
                <span className="text-sm font-medium text-brand-dark">{r.productName}</span>
                {!r.isApproved && (
                  <span className="rounded-full bg-amber-200 text-amber-900 px-2 py-0.5 text-[11px] font-medium">
                    Pending
                  </span>
                )}
              </div>
              {r.title && <p className="mt-1 font-semibold text-brand-dark">{r.title}</p>}
              <p className="mt-1 text-sm text-brand-brown/80 whitespace-pre-wrap">{r.body}</p>
              <p className="mt-1 text-xs text-brand-brown/50">
                — {r.authorName} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {r.isApproved ? (
                <button
                  onClick={() => approve(r.id, false)}
                  disabled={busy === r.id}
                  className="rounded-lg border border-brand-warm/60 px-3 py-1.5 text-sm text-brand-brown hover:bg-brand-warm/30 disabled:opacity-50"
                >
                  Hide
                </button>
              ) : (
                <button
                  onClick={() => approve(r.id, true)}
                  disabled={busy === r.id}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              <button
                onClick={() => remove(r.id)}
                disabled={busy === r.id}
                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
