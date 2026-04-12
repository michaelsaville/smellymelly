import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/app/lib/admin-auth'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { password?: string }

  if (!body.password || !verifyPassword(body.password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('sm_admin', 'sm_authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return res
}
