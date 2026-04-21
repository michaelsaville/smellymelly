import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { renderToBuffer } from '@react-pdf/renderer'
import { prisma } from '@/app/lib/prisma'
import {
  OrderFormDocument,
  type OrderFormData,
  type OrderFormProduct,
} from '@/app/lib/order-form-pdf'
import { loadLogoBuffer } from '@/app/lib/logo-buffer'

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/uploads'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

async function loadImageBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) return null
  // URLs look like /api/uploads/products/{filename}; resolve to disk.
  const filename = url.split('/').pop()
  if (!filename || filename.includes('..')) return null
  try {
    return await readFile(join(UPLOADS_DIR, 'products', filename))
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [products, settings] = await Promise.all([
    prisma.sM_Product.findMany({
      where: {
        isActive: true,
        variants: { some: { isActive: true } },
      },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { priceCents: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    }),
    prisma.sM_Settings.findFirst({ where: { id: 'singleton' } }),
  ])

  const productsForPdf: OrderFormProduct[] = []
  for (const product of products) {
    const imageUrl = product.images[0]?.url ?? null
    const imageBuffer = await loadImageBuffer(imageUrl)
    productsForPdf.push({
      id: product.id,
      name: product.name,
      category: product.category.name,
      description: product.description,
      imageBuffer,
      variants: product.variants.map((v) => ({
        id: v.id,
        productName: product.name,
        variantName: v.name,
        scent: product.scent,
        category: product.category.name,
        priceCents: v.priceCents,
      })),
    })
  }

  // Build payment line. Only mention "Pay by …" when at least one handle is
  // set — otherwise you get the reader-hostile "Pay by  or cash on delivery".
  const handles: string[] = []
  if (settings?.venmoHandle) handles.push(`Venmo ${settings.venmoHandle}`)
  if (settings?.cashAppTag) handles.push(`Cash App ${settings.cashAppTag}`)
  let paymentNote: string
  if (settings?.paymentInstructions?.trim()) {
    paymentNote = settings.paymentInstructions.trim()
  } else if (handles.length > 0) {
    paymentNote = `Pay by ${[...handles, 'or cash on delivery'].join(', ')}. We'll confirm your total when we deliver.`
  } else {
    paymentNote = "Pay with cash or check on delivery. We'll confirm your total when we deliver."
  }

  const logo = await loadLogoBuffer()

  const data: OrderFormData = {
    businessName: settings?.businessName ?? 'Smelly Melly',
    businessPhone: settings?.businessPhone ?? null,
    businessEmail: settings?.businessEmail ?? null,
    paymentNote,
    logoBuffer: logo?.buffer ?? null,
    logoFormat: logo?.format ?? null,
    products: productsForPdf,
  }

  try {
    const buffer = await renderToBuffer(OrderFormDocument({ data }))
    const filename = `smelly-melly-order-form-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[order-forms/pdf] render failed:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
