'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setInquiryStatus, deleteInquiry } from '@/app/lib/actions/inquiries'

type Row = {
  id: string
  type: string
  name: string
  email: string
  phone: string | null
  business: string | null
  message: string
  status: string
  createdAt: string
}

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

export default function InquiryList({ inquiries }: { inquiries: Row[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  async function setStatus(id: string, status: string) {
    setBusy(id)
    await setInquiryStatus(id, status)
    setBusy(null)
    router.refresh()
  }
  async function remove(id: string) {
    if (!confirm('Delete this request?')) return
    setBusy(id)
    await deleteInquiry(id)
    setBusy(null)
    router.refresh()
  }

  if (inquiries.length === 0) {
    return <div className="card text-center py-12 text-brand-brown/60">No requests yet.</div>
  }

  return (
    <div className="space-y-3">
      {inquiries.map((q) => (
        <div key={q.id} className={`card ${q.status === 'NEW' ? 'border-amber-300' : ''}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-brand-terra/15 text-brand-terra px-2 py-0.5 text-[11px] font-medium">
                  {q.type === 'WHOLESALE' ? 'Wholesale' : 'Custom'}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[q.status] ?? ''}`}>
                  {q.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-brand-brown/50">{new Date(q.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="mt-1 font-medium text-brand-dark">
                {q.name}{q.business ? ` · ${q.business}` : ''}
              </p>
              <p className="text-sm text-brand-brown/70">
                <a href={`mailto:${q.email}`} className="text-brand-terra hover:underline">{q.email}</a>
                {q.phone ? ` · ${q.phone}` : ''}
              </p>
              <p className="mt-2 text-sm text-brand-brown/80 whitespace-pre-wrap">{q.message}</p>
            </div>
            <div className="flex flex-col gap-2 items-stretch">
              <Link
                href={`/admin/invoices/new?name=${encodeURIComponent(q.name)}&email=${encodeURIComponent(q.email)}`}
                className="btn-primary text-sm text-center"
              >
                Create invoice
              </Link>
              <select
                value={q.status}
                onChange={(e) => setStatus(q.id, e.target.value)}
                disabled={busy === q.id}
                className="rounded-lg border border-brand-warm/60 px-2 py-1.5 text-sm"
              >
                <option value="NEW">New</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="CLOSED">Closed</option>
              </select>
              <button
                onClick={() => remove(q.id)}
                disabled={busy === q.id}
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
