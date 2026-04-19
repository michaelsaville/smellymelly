import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const filename = path[path.length - 1]

  // Prevent path traversal
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const filepath = join(UPLOADS_DIR, 'products', filename)

  try {
    await stat(filepath)
    const buffer = await readFile(filepath)
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
