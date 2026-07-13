'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { duplicateProduct } from '@/app/lib/actions/products'

export default function DuplicateButton({ productId }: { productId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onClick() {
    if (!confirm('Duplicate this product as a new inactive draft?')) return
    setBusy(true)
    try {
      const res = await duplicateProduct(productId)
      if (res.ok && res.id) {
        router.push(`/admin/products/${res.id}`)
      } else {
        alert(res.error ?? 'Could not duplicate this product.')
        setBusy(false)
      }
    } catch {
      alert('Could not duplicate this product.')
      setBusy(false)
    }
  }

  return (
    <button type="button" onClick={onClick} disabled={busy} className="btn-ghost text-sm disabled:opacity-50">
      {busy ? 'Duplicating…' : 'Duplicate'}
    </button>
  )
}
