import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import InquiryList from './InquiryList'

export const dynamic = 'force-dynamic'

export default async function InquiriesPage() {
  await requireAdmin()

  const inquiries = await prisma.sM_Inquiry.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })
  const open = inquiries.filter((q) => q.status === 'NEW').length

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">Requests</h1>
      <p className="text-sm text-brand-brown/60 mb-6">
        Custom-order and wholesale requests from the storefront.
        {open > 0 && <span className="ml-1 font-medium text-amber-700">{open} new.</span>}
      </p>
      <InquiryList
        inquiries={inquiries.map((q) => ({
          id: q.id,
          type: q.type,
          name: q.name,
          email: q.email,
          phone: q.phone,
          business: q.business,
          message: q.message,
          status: q.status,
          createdAt: q.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
