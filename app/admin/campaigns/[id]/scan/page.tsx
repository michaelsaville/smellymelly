import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { CampaignScanClient } from './CampaignScanClient'

export const dynamic = 'force-dynamic'

export default async function CampaignScanPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const campaign = await prisma.sM_Campaign.findUnique({
    where: { id },
    include: {
      host: { select: { name: true } },
    },
  })
  if (!campaign) notFound()

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/admin/campaigns/${campaign.id}`}
          className="text-sm text-brand-brown/60 hover:text-brand-terra"
        >
          ← {campaign.name}
        </Link>
      </div>
      <h1 className="font-display text-3xl font-bold text-brand-dark">
        Scan paper fundraiser form
      </h1>
      <p className="mt-2 text-brand-brown/60">
        Upload a photo of a completed roster sheet from the <strong>{campaign.name}</strong>{' '}
        fundraiser hosted by <strong>{campaign.host.name}</strong>. Claude reads
        every buyer row and their quantities, you review, and we create one
        order per buyer tagged with this campaign.
      </p>

      <CampaignScanClient campaignId={campaign.id} campaignName={campaign.name} />
    </div>
  )
}
