import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { NewCampaignForm } from './NewCampaignForm'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage() {
  await requireAdmin()

  const [hosts, products] = await Promise.all([
    prisma.sM_Host.findMany({ orderBy: { name: 'asc' } }),
    prisma.sM_Product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, priceCents: true, stockQuantity: true },
        },
      },
    }),
  ])

  const productsWithVariants = products.filter((p) => p.variants.length > 0)

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/campaigns"
          className="text-sm text-brand-brown/60 hover:text-brand-terra"
        >
          ← Campaigns
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold text-brand-dark">
          New campaign
        </h1>
      </div>

      <NewCampaignForm
        hosts={hosts.map((h) => ({ id: h.id, name: h.name }))}
        products={productsWithVariants.map((p) => ({
          id: p.id,
          name: p.name,
          variants: p.variants,
        }))}
      />
    </div>
  )
}
