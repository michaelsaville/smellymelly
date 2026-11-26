import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { formatGiftCode, PAID_WITH_OPTIONS } from '@/app/lib/gift-cards'
import BlankEntry from './BlankEntry'

export const dynamic = 'force-dynamic'

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  await requireAdmin()
  const { batchId } = await params

  const cards = await prisma.sM_GiftCard.findMany({
    where: { batchId },
    orderBy: { createdAt: 'asc' },
  })
  if (cards.length === 0) notFound()

  const rows = cards.map((c) => ({
    id: c.id,
    code: c.code,
    formattedCode: formatGiftCode(c.code),
    last4: c.last4,
    status: c.status,
    initialCents: c.initialCents,
    recipientName: c.recipientName,
    purchaserName: c.purchaserName,
    issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
  }))

  return (
    <div>
      <div className="mb-2 text-sm">
        <Link href="/admin/gift-cards" className="text-brand-terra hover:underline">
          ← Gift Certificates
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-brand-dark">Pre-printed batch</h1>
          <p className="mt-1 text-sm text-brand-brown/60">
            Printed {cards[0].createdAt.toLocaleDateString()} · {cards.length} certificates
          </p>
        </div>
        <Link
          href={`/admin/gift-cards/batch/${batchId}/print`}
          className="btn-secondary text-sm"
        >
          Print unsold blanks
        </Link>
      </div>
      <BlankEntry cards={rows} paidWithOptions={[...PAID_WITH_OPTIONS]} />
    </div>
  )
}
