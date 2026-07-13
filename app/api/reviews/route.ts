import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'

// Simple in-memory per-IP rate limit (long-lived standalone server). 5 reviews
// per IP per 10 min — plenty for a real shopper, tight against spam floods.
const RL = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const win = 10 * 60 * 1000
  const hits = (RL.get(ip) ?? []).filter((t) => now - t < win)
  hits.push(now)
  RL.set(ip, hits)
  if (RL.size > 5000) RL.clear() // crude memory cap
  return hits.length > 5
}

// Public review submission. Lands unapproved; Mel approves in /admin/reviews.
export async function POST(req: NextRequest) {
  let body: { productId?: string; authorName?: string; rating?: number; title?: string; body?: string; website?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  // Honeypot: real users never see/fill `website`. Bots that bulk-fill trip it;
  // silently accept so they don't learn they were filtered.
  if (body.website && String(body.website).trim() !== '') {
    return NextResponse.json({ ok: true })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many reviews too quickly. Please try again later.' }, { status: 429 })
  }

  const productId = String(body.productId ?? '')
  const authorName = String(body.authorName ?? '').trim().slice(0, 80)
  const rating = Math.round(Number(body.rating))
  const title = body.title ? String(body.title).trim().slice(0, 120) : null
  const text = String(body.body ?? '').trim().slice(0, 2000)

  if (!authorName) return NextResponse.json({ error: 'Please add your name.' }, { status: 400 })
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: 'Please choose a star rating.' }, { status: 400 })
  if (text.length < 3) return NextResponse.json({ error: 'Please write a short review.' }, { status: 400 })

  const product = await prisma.sM_Product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })

  await prisma.sM_Review.create({
    data: { productId, authorName, rating, title, body: text },
  })

  return NextResponse.json({ ok: true })
}
