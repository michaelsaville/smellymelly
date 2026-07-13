import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import DiscountManager from './DiscountManager'

export const dynamic = 'force-dynamic'

export default async function DiscountsAdminPage() {
  await requireAdmin()

  const codes = await prisma.sM_DiscountCode.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  })

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">Promo Codes</h1>
      <p className="text-sm text-brand-brown/60 mb-6">
        Discount codes customers can enter at checkout. Percent or fixed amount, with
        optional usage limits, minimum order, and expiry.
      </p>

      <DiscountManager
        codes={codes.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value,
          isActive: c.isActive,
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          minSubtotalCents: c.minSubtotalCents,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
          notes: c.notes,
        }))}
      />
    </div>
  )
}
