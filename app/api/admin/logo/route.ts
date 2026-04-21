import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { prisma } from '@/app/lib/prisma'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB — logos should be small
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

/** Strip a previously-uploaded logo file from disk. Non-fatal on miss. */
async function removeOldFile(logoUrl: string | null | undefined) {
  if (!logoUrl) return
  const filename = logoUrl.split('/').pop()
  if (!filename || filename.includes('..') || filename.includes('/')) return
  try {
    await unlink(join(UPLOADS_DIR, 'logo', filename))
  } catch {
    // already gone
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'File must be PNG, JPEG, WebP, or SVG' },
      { status: 400 },
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be under 5 MB' }, { status: 400 })
  }

  const ext =
    file.type === 'image/svg+xml'
      ? 'svg'
      : file.name.split('.').pop()?.toLowerCase() || 'png'
  const filename = `${randomUUID()}.${ext}`
  const dir = join(UPLOADS_DIR, 'logo')

  try {
    await mkdir(dir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(dir, filename), buffer)

    // Clear the old file (if any) after a successful write, then flip the
    // settings pointer. Order matters so we never leave the DB pointing at
    // a deleted file.
    const current = await prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
    })
    const newUrl = `/api/uploads/logo/${filename}`
    await prisma.sM_Settings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', logoUrl: newUrl },
      update: { logoUrl: newUrl },
    })
    if (current?.logoUrl && current.logoUrl !== newUrl) {
      await removeOldFile(current.logoUrl)
    }

    return NextResponse.json({ logoUrl: newUrl }, { status: 201 })
  } catch (err) {
    console.error('[admin/logo] upload failed', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const current = await prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
    })
    await prisma.sM_Settings.update({
      where: { id: 'singleton' },
      data: { logoUrl: null },
    })
    await removeOldFile(current?.logoUrl)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/logo] delete failed', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
