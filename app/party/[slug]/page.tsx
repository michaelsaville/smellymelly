import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import { PartyShop } from './PartyShop'

export const dynamic = 'force-dynamic'

export default async function PartyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const campaign = await prisma.sM_Campaign.findUnique({
    where: { slug },
    include: {
      host: { select: { name: true } },
      variants: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!campaign) notFound()

  const now = new Date()
  const windowOk =
    (!campaign.startsAt || campaign.startsAt <= now) &&
    (!campaign.endsAt || campaign.endsAt >= now)

  if (campaign.status !== 'ACTIVE' || !windowOk) {
    return (
      <div className="min-h-screen bg-brand-warm/20 flex items-center justify-center p-6">
        <div className="max-w-md text-center card bg-white">
          <div className="text-5xl mb-3">🕯️</div>
          <h1 className="font-display text-2xl font-bold text-brand-dark">
            {campaign.name}
          </h1>
          <p className="mt-3 text-brand-brown/70">
            {campaign.status === 'DRAFT'
              ? "This fundraiser hasn't started yet — check back soon."
              : campaign.status === 'CLOSED'
                ? "This fundraiser has wrapped up. Thanks for your support!"
                : campaign.startsAt && campaign.startsAt > now
                  ? `Starts ${campaign.startsAt.toLocaleString()}.`
                  : "This fundraiser isn't accepting orders right now."}
          </p>
          <Link href="/" className="btn-secondary mt-6 inline-block">
            Visit smellymellys.net
          </Link>
        </div>
      </div>
    )
  }

  const items = campaign.variants
    .filter((cv) => cv.variant.isActive && cv.variant.product.isActive)
    .map((cv) => ({
      variantId: cv.variant.id,
      productName: cv.variant.product.name,
      variantName: cv.variant.name,
      imageUrl: cv.variant.product.images[0]?.url ?? null,
      stockQuantity: cv.variant.stockQuantity,
    }))

  return (
    <PartyShop
      slug={campaign.slug}
      name={campaign.name}
      description={campaign.description}
      hostName={campaign.host.name}
      customerPriceCents={campaign.customerPriceCents}
      items={items}
    />
  )
}
