import { NextRequest, NextResponse } from 'next/server'
import { sendContactFormRelay } from '@/app/lib/email'

interface ContactBody {
  name?: string
  email?: string
  message?: string
  honeypot?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: ContactBody
  try {
    body = (await req.json()) as ContactBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  // Honeypot field; real users leave it blank, bots fill it.
  if (body.honeypot) {
    return NextResponse.json({ ok: true })
  }

  const name = (body.name || '').trim()
  const email = (body.email || '').trim()
  const message = (body.message || '').trim()

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message is too long (max 5000 characters).' }, { status: 400 })
  }

  try {
    await sendContactFormRelay({ name, email, message })
  } catch (err) {
    console.error('[contact] relay failed:', err)
    return NextResponse.json({ error: "Couldn't send message. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
