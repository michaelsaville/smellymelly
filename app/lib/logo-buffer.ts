import 'server-only'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/app/lib/prisma'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'

/** react-pdf only supports raster formats for Image.src with a buffer. */
export interface LogoAsset {
  buffer: Buffer
  format: 'png' | 'jpg'
}

/**
 * Load the site logo from disk as a Buffer for embedding in react-pdf.
 * Returns null when no logo is set, the file has an unsupported format
 * (SVG — react-pdf can't render an SVG from a raw Buffer), or the file
 * is missing on disk.
 */
export async function loadLogoBuffer(): Promise<LogoAsset | null> {
  const settings = await prisma.sM_Settings.findUnique({
    where: { id: 'singleton' },
    select: { logoUrl: true },
  })
  const url = settings?.logoUrl
  if (!url) return null

  const filename = url.split('/').pop()
  if (!filename || filename.includes('..') || filename.includes('/')) return null
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  let format: 'png' | 'jpg'
  if (ext === 'png') format = 'png'
  else if (ext === 'jpg' || ext === 'jpeg') format = 'jpg'
  else return null // SVG / WebP — web renders fine, PDF falls back to wordmark

  try {
    const buffer = await readFile(join(UPLOADS_DIR, 'logo', filename))
    return { buffer, format }
  } catch {
    return null
  }
}
