import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface PostBody {
  name?: string
  color?: string
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const BRAND_COLORS = ['#C67D4A', '#8a7360', '#5b4a3a', '#2e7d5c', '#b8454b', '#4a6fa5']

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as PostBody
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'Tag name required' }, { status: 400 })
  }
  if (name.length > 32) {
    return NextResponse.json({ error: 'Tag name must be 32 characters or less' }, { status: 400 })
  }

  const color =
    body.color && HEX_COLOR.test(body.color)
      ? body.color
      : BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)]

  try {
    const tag = await prisma.sM_Tag.create({
      data: { name, color },
    })
    return NextResponse.json({ tag })
  } catch {
    // Unique violation — tag name already exists. Return the existing one so
    // the client can idempotently "create" then toggle.
    const existing = await prisma.sM_Tag.findUnique({ where: { name } })
    if (existing) return NextResponse.json({ tag: existing })
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}
