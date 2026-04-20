import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { CampaignDashboard } from './CampaignDashboard'

export const dynamic = 'force-dynamic'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const campaign = await prisma.sM_Campaign.findUnique({
    where: { id },
    include: {
      host: true,
      variants: {
        include: {
          variant: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              stockQuantity: true,
              product: { select: { id: true, name: true } },
            },
          },
        },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            select: { quantity: true, unitCents: true, totalCents: true, variantName: true, productName: true },
          },
        },
      },
    },
  })
  if (!campaign) notFound()

  // Also give the form the full variant list so we can re-edit the variant picker
  const products = await prisma.sM_Product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, priceCents: true, stockQuantity: true },
      },
    },
  })

  // Build public origin for share links (used client-side too)
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'smellymellys.net'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = process.env.PUBLIC_URL ?? `${proto}://${host}`

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
    <div>
      <div className="mb-4">
        <Link
          href="/admin/campaigns"
          className="text-sm text-brand-brown/60 hover:text-brand-terra"
        >
          ← Campaigns
        </Link>
      </div>

      <CampaignDashboard
        origin={origin}
        campaign={{
          id: campaign.id,
          slug: campaign.slug,
          name: campaign.name,
          description: campaign.description,
          status: campaign.status,
          customerPriceCents: campaign.customerPriceCents,
          mellyCutCents: campaign.mellyCutCents,
          startsAt: campaign.startsAt?.toISOString() ?? null,
          endsAt: campaign.endsAt?.toISOString() ?? null,
          hostToken: campaign.hostToken,
          host: {
            id: campaign.host.id,
            name: campaign.host.name,
            email: campaign.host.email,
            phone: campaign.host.phone,
          },
          variants: campaign.variants.map((cv) => ({
            id: cv.variant.id,
            productName: cv.variant.product.name,
            variantName: cv.variant.name,
            priceCents: cv.variant.priceCents,
            stockQuantity: cv.variant.stockQuantity,
          })),
          orders: campaign.orders.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            createdAt: o.createdAt.toISOString(),
            status: o.status,
            customerName: o.customerName,
            customerEmail: o.customerEmail,
            subtotalCents: o.subtotalCents,
            itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
          })),
        }}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          variants: p.variants,
        }))}
        stats={{ itemsSold, raisedCents, hostCutCents, mellyTakeCents }}
      />
    </div>
  )
}
