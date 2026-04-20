import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'
import { HostDashboard } from './HostDashboard'

export const dynamic = 'force-dynamic'

export default async function HostPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const campaign = await prisma.sM_Campaign.findUnique({
    where: { hostToken: token },
    include: {
      host: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            select: {
              quantity: true,
              productName: true,
              variantName: true,
              totalCents: true,
            },
          },
        },
      },
    },
  })
  if (!campaign) {
    return (
      <div className="min-h-screen bg-brand-warm/20 flex items-center justify-center p-6">
        <div className="max-w-md text-center card bg-white">
          <div className="text-4xl mb-3">🔗</div>
          <h1 className="font-display text-xl font-bold text-brand-dark">
            This host link isn&apos;t valid
          </h1>
          <p className="mt-3 text-sm text-brand-brown/70">
            The link may have expired or been rotated. Ask Mel for a fresh one.
          </p>
          <Link
            href="/"
            className="btn-secondary mt-6 inline-block"
          >
            smellymellys.net
          </Link>
        </div>
      </div>
    )
  }

  const nonCancelled = campaign.orders.filter(
    (o) => o.status !== 'CANCELLED' && o.status !== 'REFUNDED',
  )
  const itemsSold = nonCancelled.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
    0,
  )
  const raisedCents = nonCancelled.reduce((sum, o) => sum + o.subtotalCents, 0)
  const hostCutCents =
    itemsSold * (campaign.customerPriceCents - campaign.mellyCutCents)
  const mellyTakeCents = itemsSold * campaign.mellyCutCents

  return (
    <HostDashboard
      campaign={{
        name: campaign.name,
        slug: campaign.slug,
        status: campaign.status,
        customerPriceCents: campaign.customerPriceCents,
        mellyCutCents: campaign.mellyCutCents,
        hostCutPerItemCents:
          campaign.customerPriceCents - campaign.mellyCutCents,
        startsAt: campaign.startsAt?.toISOString() ?? null,
        endsAt: campaign.endsAt?.toISOString() ?? null,
        hostName: campaign.host.name,
      }}
      orders={campaign.orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customerName,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        subtotalCents: o.subtotalCents,
        items: o.items.map((i) => ({
          productName: i.productName,
          variantName: i.variantName,
          quantity: i.quantity,
        })),
      }))}
      stats={{ itemsSold, raisedCents, hostCutCents, mellyTakeCents }}
    />
  )
}
