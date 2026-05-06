import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB — icons should be tiny
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

// Upload a custom icon for a category. Returns the public URL only — the
// caller is responsible for writing it onto SM_Category.iconImageUrl via
// PATCH /api/admin/categories.
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
      { error: 'File must be PNG, JPEG, WebP, GIF, or SVG' },
      { status: 400 },
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File must be under 2 MB' },
      { status: 400 },
    )
  }

  const ext =
    file.type === 'image/svg+xml'
      ? 'svg'
      : file.name.split('.').pop()?.toLowerCase() || 'png'
  const filename = `${randomUUID()}.${ext}`
  const dir = join(UPLOADS_DIR, 'category-icons')

  try {
    await mkdir(dir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(dir, filename), buffer)
    return NextResponse.json({
      url: `/api/uploads/category-icons/${filename}`,
    })
  } catch (err) {
    console.error('[admin/categories/icon] upload failed:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
