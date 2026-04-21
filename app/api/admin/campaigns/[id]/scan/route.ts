import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

const MAX_FILE_SIZE = 15 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface ExtractedOrder {
  buyerNum: number
  variantId: string
  quantity: number
  productName: string
  variantName: string
}

interface ExtractedBuyer {
  num: number
  name: string | null
  phone: string | null
  notes: string | null
  items: Array<{
    variantId: string
    quantity: number
    productName: string
    variantName: string
  }>
  subtotalCents: number
}

interface CampaignScanResponse {
  campaignId: string
  customerPriceCents: number
  buyers: ExtractedBuyer[]
  unmatched: Array<{ rawText: string; quantity: number; buyerNum: number | null }>
  confidence: 'high' | 'medium' | 'low'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    )
  }

  const campaign = await prisma.sM_Campaign.findUnique({
    where: { id },
    include: {
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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'File must be JPEG, PNG, or WebP' },
      { status: 400 },
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be under 15 MB' }, { status: 400 })
  }

  const variantCatalog = campaign.variants.map((cv) => ({
    variantId: cv.variant.id,
    productName: cv.variant.product.name,
    variantName: cv.variant.name,
  }))
  const variantLookup = new Map(variantCatalog.map((v) => [v.variantId, v]))
  const catalogText = variantCatalog
    .map(
      (v) =>
        `- variantId=${v.variantId} | ${v.productName} — ${v.variantName}`,
    )
    .join('\n')

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const tool: Anthropic.Tool = {
    name: 'return_paper_form_extraction',
    description:
      'Return the structured multi-buyer paper form extraction. Call exactly once.',
    input_schema: {
      type: 'object' as const,
      properties: {
        buyers: {
          type: 'array',
          description:
            'One entry per buyer SLOT that has either a name filled in OR at least one quantity written. Skip completely blank slots.',
          items: {
            type: 'object',
            properties: {
              num: {
                type: 'number',
                description: 'The buyer slot number as pre-printed on the form (1, 2, 3…).',
              },
              name: { type: ['string', 'null'] },
              phone: { type: ['string', 'null'] },
              notes: { type: ['string', 'null'] },
            },
            required: ['num', 'name', 'phone', 'notes'],
          },
        },
        orders: {
          type: 'array',
          description:
            'One entry per (buyer, variant) cell that has a quantity ≥ 1 written in. Blank cells are NOT orders.',
          items: {
            type: 'object',
            properties: {
              buyerNum: { type: 'number' },
              variantId: {
                type: 'string',
                description: 'MUST be a variantId from the catalog below.',
              },
              quantity: { type: 'number' },
            },
            required: ['buyerNum', 'variantId', 'quantity'],
          },
        },
        unmatched: {
          type: 'array',
          description:
            'Cells where you could read a quantity but could not confidently map to a catalog variantId (smudged, torn, mis-ordered).',
          items: {
            type: 'object',
            properties: {
              rawText: { type: 'string' },
              quantity: { type: 'number' },
              buyerNum: { type: ['number', 'null'] },
            },
            required: ['rawText', 'quantity', 'buyerNum'],
          },
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description:
            '"low" if handwriting is hard, image is blurry, or many cells went to unmatched.',
        },
      },
      required: ['buyers', 'orders', 'unmatched', 'confidence'],
    },
  }

  const systemPrompt = `You are processing a handwritten multi-buyer paper fundraiser form for a handmade bath & body business called Smelly Melly.

The form belongs to a specific campaign: "${campaign.name}". Every item is priced at $${(campaign.customerPriceCents / 100).toFixed(2)} — pricing is implicit, do NOT extract prices.

The form has ONE of two layouts. Detect which and extract accordingly:

LAYOUT A — buyers-as-rows. Each row is a numbered buyer (1, 2, 3, …). Columns include: Buyer #, Buyer name, Phone, N product columns (one per campaign variant), Notes, Total. Each cell in a product column holds a quantity for that buyer + that variant.

LAYOUT B — variants-as-rows. A "Buyer legend" block at the top maps slot numbers 1–N to handwritten names + phones. Below, each row is a product; columns 1–N are the buyers. Each cell holds the quantity that buyer wants of that product.

CRITICAL RULES:
- ONLY extract cells with a clearly-written quantity ≥ 1. Blank boxes, zero, dashes, or question marks mean NO order — skip them.
- Each order's variantId MUST come from the catalog below. If ambiguous, put it in unmatched instead of guessing.
- buyerNum always matches the pre-printed slot number, NOT the order in which names are written. Someone skipping to row 7 with others blank is still num=7.
- Only emit a buyer entry when that slot either has a legible name OR at least one quantity was written under it. Skip entirely empty slots.
- Read digits carefully: "1" vs "7", "2" vs "Z". Prefer unmatched if unsure.
- Set confidence="low" if any of: image is blurry/dark, lots of cells went to unmatched, buyer names are mostly unreadable.

CAMPAIGN VARIANT CATALOG (use these variantIds exactly):
${catalogText}`

  const client = new Anthropic({ apiKey })

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'return_paper_form_extraction' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Extract the completed multi-buyer paper form for campaign "${campaign.name}".`,
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('[campaigns/scan] anthropic error:', err)
    return NextResponse.json(
      { error: 'Vision extraction failed. Check ANTHROPIC_API_KEY and try again.' },
      { status: 500 },
    )
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolUse) {
    return NextResponse.json(
      { error: 'Model did not return a structured extraction.' },
      { status: 502 },
    )
  }

  const raw = toolUse.input as {
    buyers: Array<{ num: number; name: string | null; phone: string | null; notes: string | null }>
    orders: Array<{ buyerNum: number; variantId: string; quantity: number }>
    unmatched: Array<{ rawText: string; quantity: number; buyerNum: number | null }>
    confidence: 'high' | 'medium' | 'low'
  }

  // Hydrate orders with catalog data; bucket any with an unknown variantId.
  const hydratedOrders: ExtractedOrder[] = []
  const extraUnmatched: Array<{ rawText: string; quantity: number; buyerNum: number | null }> = []
  for (const o of raw.orders ?? []) {
    const hit = variantLookup.get(o.variantId)
    const qty = Math.max(0, Math.round(o.quantity))
    if (!hit || qty < 1) {
      extraUnmatched.push({
        rawText: hit ? `${hit.productName} — ${hit.variantName}` : `unknown variantId ${o.variantId}`,
        quantity: qty,
        buyerNum: o.buyerNum ?? null,
      })
      continue
    }
    hydratedOrders.push({
      buyerNum: o.buyerNum,
      variantId: o.variantId,
      quantity: qty,
      productName: hit.productName,
      variantName: hit.variantName,
    })
  }

  // Group orders under each buyer, and drop buyer rows that ended up empty.
  const buyersByNum = new Map<number, ExtractedBuyer>()
  for (const b of raw.buyers ?? []) {
    buyersByNum.set(b.num, {
      num: b.num,
      name: b.name,
      phone: b.phone,
      notes: b.notes,
      items: [],
      subtotalCents: 0,
    })
  }
  for (const o of hydratedOrders) {
    let entry = buyersByNum.get(o.buyerNum)
    if (!entry) {
      // Buyer was implicit (had items but wasn't listed up top); create stub.
      entry = {
        num: o.buyerNum,
        name: null,
        phone: null,
        notes: null,
        items: [],
        subtotalCents: 0,
      }
      buyersByNum.set(o.buyerNum, entry)
    }
    entry.items.push({
      variantId: o.variantId,
      quantity: o.quantity,
      productName: o.productName,
      variantName: o.variantName,
    })
    entry.subtotalCents += o.quantity * campaign.customerPriceCents
  }

  const buyers = [...buyersByNum.values()]
    .filter((b) => b.items.length > 0 || b.name)
    .sort((a, b) => a.num - b.num)

  const result: CampaignScanResponse = {
    campaignId: campaign.id,
    customerPriceCents: campaign.customerPriceCents,
    buyers,
    unmatched: [...(raw.unmatched ?? []), ...extraUnmatched],
    confidence: raw.confidence ?? 'medium',
  }

  return NextResponse.json(result)
}
