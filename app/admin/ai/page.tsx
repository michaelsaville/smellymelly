import { requireAdmin } from '@/app/lib/admin-auth'
import AIChat from './AIChat'

export const dynamic = 'force-dynamic'

export default async function AIPage() {
  await requireAdmin()

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          AI Assistant
        </h1>
        <p className="text-sm text-brand-brown/60 mt-1">
          Tell me what you need and I&apos;ll handle it — add products, update
          inventory, manage materials, whatever you want.
        </p>
      </div>
      <AIChat />
    </div>
  )
}
