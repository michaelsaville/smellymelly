import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/app/lib/prisma'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'

/** Sizes we advertise via metadata — any other size returns 400. */
const ALLOWED_SIZES = new Set([16, 32, 48, 180, 192, 512])

/**
 * Resize the uploaded site logo to a favicon/app-icon at the requested
 * size. Responds with a long-cached PNG. Returns 404 if no logo is set
 * — layout.tsx metadata skips the <link rel=icon> entries in that case,
 * so browsers just use their default.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeRaw } = await params
  const size = Number(sizeRaw)
  if (!Number.isInteger(size) || !ALLOWED_SIZES.has(size)) {
    return NextResponse.json(
      { error: `size must be one of ${[...ALLOWED_SIZES].join(', ')}` },
      { status: 400 },
    )
  }

  const settings = await prisma.sM_Settings.findUnique({
    where: { id: 'singleton' },
    select: { logoUrl: true },
  })
  const url = settings?.logoUrl
  if (!url) {
    return NextResponse.json({ error: 'No logo uploaded' }, { status: 404 })
  }

  const filename = url.split('/').pop()
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let source: Buffer
  try {
    source = await readFile(join(UPLOADS_DIR, 'logo', filename))
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    // Fit inside the square with transparent padding so non-square logos
    // don't get squashed. Alpha-aware for PNG / SVG / WebP; JPEGs get a
    // solid white background since they have no alpha channel.
    const ext = filename.split('.').pop()?.toLowerCase()
    const background =
      ext === 'jpg' || ext === 'jpeg'
        ? { r: 255, g: 255, b: 255, alpha: 1 }
        : { r: 0, g: 0, b: 0, alpha: 0 }

    const out = await sharp(source)
      .resize(size, size, {
        fit: 'contain',
        background,
      })
      .png()
      .toBuffer()

    return new NextResponse(new Uint8Array(out), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    console.error('[favicon] resize failed', err)
    return NextResponse.json({ error: 'Resize failed' }, { status: 500 })
  }
}
