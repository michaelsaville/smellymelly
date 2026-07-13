import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { sendAdminAlert } from '@/app/lib/email'

export async function POST(req: NextRequest) {
  let body: {
    type?: string
    name?: string
    email?: string
    phone?: string
    business?: string
    message?: string
    honeypot?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  // Simple spam trap.
  if (body.honeypot) return NextResponse.json({ ok: true })

  const type = body.type === 'WHOLESALE' ? 'WHOLESALE' : 'CUSTOM'
  const name = String(body.name ?? '').trim().slice(0, 120)
  const email = String(body.email ?? '').trim().slice(0, 160)
  const phone = body.phone ? String(body.phone).trim().slice(0, 40) : null
  const business = body.business ? String(body.business).trim().slice(0, 160) : null
  const message = String(body.message ?? '').trim().slice(0, 4000)

  if (!name || !email || message.length < 3) {
    return NextResponse.json({ error: 'Please add your name, email, and a message.' }, { status: 400 })
  }

  await prisma.sM_Inquiry.create({
    data: { type, name, email, phone, business, message },
  })

  sendAdminAlert({
    subject: `New ${type === 'WHOLESALE' ? 'wholesale' : 'custom order'} request`,
    lines: [
      `From: ${name} <${email}>`,
      phone ? `Phone: ${phone}` : '',
      business ? `Business: ${business}` : '',
      '',
      message,
      '',
      'View + reply in the admin under Requests.',
    ].filter(Boolean),
  }).catch((err) => console.error('[inquiry] alert failed:', err))

  return NextResponse.json({ ok: true })
}
