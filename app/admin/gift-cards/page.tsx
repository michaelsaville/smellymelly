import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { formatGiftCode } from '@/app/lib/gift-cards'
import GiftCardManager from './GiftCardManager'

export const dynamic = 'force-dynamic'

export default async function GiftCardsPage() {
  await requireAdmin()

  const [cards, liability, redeemedAgg] = await Promise.all([
    prisma.sM_GiftCard.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    // Outstanding balance on live cards = the deferred-revenue liability, i.e.
    // goods Mel still owes. This is the number a CPA asks for.
    prisma.sM_GiftCard.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { balanceCents: true },
    }),
    prisma.sM_GiftCardTxn.aggregate({
      where: { type: 'REDEEM' },
      _sum: { amountCents: true },
    }),
  ])

  const rows = cards.map((c) => ({
    id: c.id,
    code: c.code,
    formattedCode: formatGiftCode(c.code),
    status: c.status,
    initialCents: c.initialCents,
    balanceCents: c.balanceCents,
    recipientName: c.recipientName,
    purchaserName: c.purchaserName,
    issueReason: c.issueReason,
    issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <GiftCardManager
      cards={rows}
      outstandingCents={liability._sum.balanceCents ?? 0}
      // REDEEM rows are stored negative; flip the sign for display.
      redeemedCents={Math.abs(redeemedAgg._sum.amountCents ?? 0)}
    />
  )
}
