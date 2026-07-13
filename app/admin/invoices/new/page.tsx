import { requireAdmin } from '@/app/lib/admin-auth'
import InvoiceForm from './InvoiceForm'

export const dynamic = 'force-dynamic'

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const get = (k: string) => {
    const v = sp[k]
    return Array.isArray(v) ? v[0] : v
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">New invoice</h1>
        <a href="/admin/invoices" className="btn-ghost text-sm">&larr; Invoices</a>
      </div>
      <InvoiceForm initialName={get('name')} initialEmail={get('email')} />
    </div>
  )
}
