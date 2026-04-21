import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/app/lib/prisma'
import {
  CampaignPaperFormDocument,
  type CampaignPaperData,
} from '@/app/lib/campaign-paper-form-pdf'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const campaign = await prisma.sM_Campaign.findUnique({
    where: { id },
    include: {
      host: true,
      variants: {
        include: {
          variant: { include: { product: { select: { name: true } } } },
        },
      },
    },
  })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (campaign.variants.length === 0) {
    return NextResponse.json(
      { error: 'Campaign has no variants selected.' },
      { status: 400 },
    )
  }

  const slotParam = req.nextUrl.searchParams.get('slots')
  const buyerSlots = Math.min(30, Math.max(5, Number(slotParam) || 15))

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'smellymellys.net'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = process.env.PUBLIC_URL ?? `${proto}://${host}`
  const partyUrl = `${origin}/party/${campaign.slug}`

  const settings = await prisma.sM_Settings.findFirst({
    where: { id: 'singleton' },
  })

  const data: CampaignPaperData = {
    businessName: settings?.businessName ?? 'Smelly Melly',
    campaignName: campaign.name,
    hostName: campaign.host.name,
    customerPriceCents: campaign.customerPriceCents,
    buyerSlots,
    partyUrl,
    variants: campaign.variants.map((cv) => ({
      variantId: cv.variant.id,
      label: `${cv.variant.product.name} · ${cv.variant.name}`,
    })),
  }

  try {
    const buffer = await renderToBuffer(CampaignPaperFormDocument({ data }))
    const filename = `smelly-melly-${campaign.slug}-paper-form.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[campaigns/paper-form] render failed:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
