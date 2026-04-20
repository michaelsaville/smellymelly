import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/app/lib/prisma'
import { findCustomerMatches, type CustomerCandidate } from '@/app/lib/customer-match'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

const MAX_FILE_SIZE = 15 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface ExtractedItem {
  variantId: string
  quantity: number
  productName: string
  variantName: string
  priceCents: number
}

interface ScanResponse {
  customer: {
    name: string | null
    phone: string | null
    email: string | null
    roomOrAddress: string | null
    notes: string | null
  }
  items: ExtractedItem[]
  unmatched: Array<{ rawText: string; quantity: number }>
  confidence: 'high' | 'medium' | 'low'
  candidates: CustomerCandidate[]
  totals: { itemCount: number; subtotalCents: number }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    )
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

  // Load active variants so Claude can match handwritten items to real variant IDs.
  const products = await prisma.sM_Product.findMany({
    where: { isActive: true, variants: { some: { isActive: true } } },
    include: {
      category: true,
      variants: { where: { isActive: true }, orderBy: { priceCents: 'asc' } },
    },
    orderBy: { name: 'asc' },
  })

  const variantCatalog: {
    variantId: string
    productName: string
    variantName: string
    category: string
    priceCents: number
  }[] = []
  for (const p of products) {
    for (const v of p.variants) {
      variantCatalog.push({
        variantId: v.id,
        productName: p.name,
        variantName: v.name,
        category: p.category.name,
        priceCents: v.priceCents,
      })
    }
  }

  const variantLookup = new Map(variantCatalog.map((v) => [v.variantId, v]))

  // Build the catalog as a compact list Claude can reference.
  const catalogText = variantCatalog
    .map(
      (v) =>
        `- variantId=${v.variantId} | ${v.productName} — ${v.variantName} (${v.category}) — $${(v.priceCents / 100).toFixed(2)}`,
    )
    .join('\n')

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

  const tool: Anthropic.Tool = {
    name: 'return_order_extraction',
    description:
      'Return the structured order extraction. Call this exactly once with the full result.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer: {
          type: 'object',
          properties: {
            name: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            roomOrAddress: { type: ['string', 'null'] },
            notes: { type: ['string', 'null'] },
          },
          required: ['name', 'phone', 'email', 'roomOrAddress', 'notes'],
        },
        items: {
          type: 'array',
          description:
            'One entry per line on the order form that has a non-empty, non-zero quantity. Only include items where quantity ≥ 1.',
          items: {
            type: 'object',
            properties: {
              variantId: {
                type: 'string',
                description:
                  'MUST be a variantId from the provided catalog. If no match, put the line in unmatched instead.',
              },
              quantity: { type: 'number' },
            },
            required: ['variantId', 'quantity'],
          },
        },
        unmatched: {
          type: 'array',
          description:
            'Lines where you could read a quantity but could not confidently match to a catalog variantId (smudged, torn, ambiguous).',
          items: {
            type: 'object',
            properties: {
              rawText: { type: 'string' },
              quantity: { type: 'number' },
            },
            required: ['rawText', 'quantity'],
          },
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description:
            'Overall confidence in the extraction. "low" if handwriting was hard or the image was poor.',
        },
      },
      required: ['customer', 'items', 'unmatched', 'confidence'],
    },
  }

  const systemPrompt = `You are processing a handwritten paper order form for a handmade bath & body business called Smelly Melly.

The form has two sections:
1. Customer info block at the top (name, phone, room/unit/address, email, notes).
2. A pre-printed table of products with columns [Product | Scent/Size | Price | Qty]. Customers write a number in the Qty box for items they want and LEAVE IT BLANK otherwise.

Your job: read the image and produce a structured extraction by calling return_order_extraction exactly once.

CRITICAL RULES:
- ONLY include items that have a clearly-written quantity ≥ 1. Blank boxes, zero, or dashes mean the customer did NOT order that item — skip it.
- Each item's variantId MUST come from the catalog below. Match by product name + scent/size. If a line is ambiguous (smudged, unreadable product name, etc.), put it in unmatched instead of guessing.
- Read quantities carefully: "1" is not "7", "2" is not "Z". If unsure, prefer unmatched.
- Set confidence="low" if any of: image is blurry/dark, lots of items went to unmatched, customer block is mostly unreadable.
- For customer.phone, keep the digits even if formatting varies. For customer.name return exactly as written.

CATALOG (use these variantIds):
${catalogText}`

  const client = new Anthropic({ apiKey })

  let response: Anthropic.Message
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'return_order_extraction' },
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
              text: 'Extract the order from this completed order form.',
            },
          ],
        },
      ],
    })
  } catch (err) {
    console.error('[order-forms/scan] anthropic error:', err)
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
    customer: ScanResponse['customer']
    items: Array<{ variantId: string; quantity: number }>
    unmatched: Array<{ rawText: string; quantity: number }>
    confidence: 'high' | 'medium' | 'low'
  }

  // Hydrate each item with the catalog data so the review UI can show names/prices.
  const items: ExtractedItem[] = []
  const extraUnmatched: Array<{ rawText: string; quantity: number }> = []
  for (const it of raw.items ?? []) {
    const hit = variantLookup.get(it.variantId)
    const qty = Math.max(0, Math.round(it.quantity))
    if (!hit || qty < 1) {
      extraUnmatched.push({
        rawText: hit ? `${hit.productName} — ${hit.variantName}` : `unknown variantId ${it.variantId}`,
        quantity: qty,
      })
      continue
    }
    items.push({
      variantId: hit.variantId,
      quantity: qty,
      productName: hit.productName,
      variantName: hit.variantName,
      priceCents: hit.priceCents,
    })
  }

  const unmatched = [...(raw.unmatched ?? []), ...extraUnmatched]

  const candidates = await findCustomerMatches(raw.customer ?? {})

  const result: ScanResponse = {
    customer: raw.customer ?? {
      name: null,
      phone: null,
      email: null,
      roomOrAddress: null,
      notes: null,
    },
    items,
    unmatched,
    confidence: raw.confidence ?? 'medium',
    candidates,
    totals: {
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      subtotalCents: items.reduce((s, i) => s + i.priceCents * i.quantity, 0),
    },
  }

  return NextResponse.json(result)
}
