import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const productId = formData.get('productId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File must be JPEG, PNG, WebP, or GIF' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 400 })
  }

  // Verify product exists
  const product = await prisma.sM_Product.findUnique({ where: { id: productId } })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  try {
    // Generate unique filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${randomUUID()}.${ext}`
    const dir = join(UPLOADS_DIR, 'products')

    await mkdir(dir, { recursive: true })
    const filepath = join(dir, filename)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)

    // Get current max sortOrder for this product
    const maxSort = await prisma.sM_ProductImage.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    })

    // Create DB record
    const image = await prisma.sM_ProductImage.create({
      data: {
        productId,
        url: `/api/uploads/products/${filename}`,
        altText: file.name.replace(/\.[^.]+$/, ''),
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })

    return NextResponse.json({ data: image }, { status: 201 })
  } catch (err) {
    console.error('[admin/images] upload failed:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageId } = (await req.json()) as { imageId: string }
  if (!imageId) {
    return NextResponse.json({ error: 'Image ID is required' }, { status: 400 })
  }

  try {
    const image = await prisma.sM_ProductImage.findUnique({ where: { id: imageId } })
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Delete from DB
    await prisma.sM_ProductImage.delete({ where: { id: imageId } })

    // Try to delete the file (non-fatal if it fails)
    try {
      const { unlink } = await import('fs/promises')
      const filename = image.url.split('/').pop()
      if (filename) {
        await unlink(join(UPLOADS_DIR, 'products', filename))
      }
    } catch {
      // File might already be gone
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/images] delete failed:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
