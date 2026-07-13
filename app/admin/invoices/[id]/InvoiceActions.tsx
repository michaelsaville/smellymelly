'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SM_InvoiceStatus } from '@prisma/client'
import { setInvoiceStatus, deleteInvoice } from '@/app/lib/actions/invoices'

export default function InvoiceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function change(s: SM_InvoiceStatus) {
    setBusy(true)
    await setInvoiceStatus(id, s)
    setBusy(false)
    router.refresh()
  }
  async function remove() {
    if (!confirm('Delete this invoice?')) return
    setBusy(true)
    await deleteInvoice(id)
    setBusy(false)
    router.push('/admin/invoices')
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button onClick={() => window.print()} className="btn-secondary text-sm">🖨 Print / PDF</button>
      {status === 'DRAFT' && (
        <button onClick={() => change('SENT')} disabled={busy} className="btn-secondary text-sm disabled:opacity-50">
          Mark sent
        </button>
      )}
      {status !== 'PAID' && status !== 'CANCELLED' && (
        <button onClick={() => change('PAID')} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
          Mark paid
        </button>
      )}
      {status !== 'CANCELLED' && status !== 'PAID' && (
        <button onClick={() => change('CANCELLED')} disabled={busy} className="text-sm text-brand-brown/60 hover:underline">
          Cancel
        </button>
      )}
      <button onClick={remove} disabled={busy} className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50 ml-auto">
        Delete
      </button>
    </div>
  )
}
