import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

interface CategoryUpdate {
  id: string
  baseIngredients: string
}

interface AllergenInput {
  id: string | null
  label: string
  matchTerms: string
  severity: string
  sortOrder: number
  isActive: boolean
}

interface Body {
  businessEmail?: string
  businessPhone?: string
  venmoHandle?: string
  cashAppTag?: string
  paymentInstructions?: string
  taxRate?: number
  productDisclaimer?: string
  menuOrientation?: string
  announcementActive?: boolean
  announcementText?: string
  announcementLink?: string
  posHideOutOfStock?: boolean
  categories?: CategoryUpdate[]
  allergens?: AllergenInput[]
}

export async function POST(req: NextRequest) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as Body
  const data: {
    businessEmail?: string | null
    businessPhone?: string | null
    venmoHandle?: string
    cashAppTag?: string
    paymentInstructions?: string
    taxRate?: number
    productDisclaimer?: string
    menuOrientation?: string
    announcementActive?: boolean
    announcementText?: string
    announcementLink?: string
    posHideOutOfStock?: boolean
  } = {}

  if (typeof body.businessEmail === 'string') {
    data.businessEmail = body.businessEmail.trim() || null
  }
  if (typeof body.businessPhone === 'string') {
    data.businessPhone = body.businessPhone.trim() || null
  }
  if (typeof body.venmoHandle === 'string') data.venmoHandle = body.venmoHandle
  if (typeof body.cashAppTag === 'string') data.cashAppTag = body.cashAppTag
  if (typeof body.paymentInstructions === 'string') {
    data.paymentInstructions = body.paymentInstructions
  }
  if (typeof body.taxRate === 'number') {
    if (body.taxRate < 0 || body.taxRate > 1) {
      return NextResponse.json(
        { error: 'taxRate must be a decimal between 0 and 1' },
        { status: 400 },
      )
    }
    data.taxRate = body.taxRate
  }
  if (typeof body.productDisclaimer === 'string') {
    data.productDisclaimer = body.productDisclaimer
  }
  if (typeof body.announcementActive === 'boolean') {
    data.announcementActive = body.announcementActive
  }
  if (typeof body.announcementText === 'string') {
    data.announcementText = body.announcementText.trim()
  }
  if (typeof body.announcementLink === 'string') {
    data.announcementLink = body.announcementLink.trim()
  }
  if (typeof body.posHideOutOfStock === 'boolean') {
    data.posHideOutOfStock = body.posHideOutOfStock
  }
  if (typeof body.menuOrientation === 'string') {
    const v = body.menuOrientation.toUpperCase()
    if (v !== 'LANDSCAPE' && v !== 'PORTRAIT') {
      return NextResponse.json(
        { error: 'menuOrientation must be LANDSCAPE or PORTRAIT' },
        { status: 400 },
      )
    }
    data.menuOrientation = v
  }

  const categoryUpdates = Array.isArray(body.categories)
    ? body.categories.filter(
        (c): c is CategoryUpdate =>
          !!c &&
          typeof c.id === 'string' &&
          typeof c.baseIngredients === 'string',
      )
    : []

  const allergensProvided = Array.isArray(body.allergens)
  const allergenInputs: AllergenInput[] = allergensProvided
    ? body
        .allergens!.filter(
          (a): a is AllergenInput =>
            !!a &&
            typeof a.label === 'string' &&
            typeof a.matchTerms === 'string',
        )
        .filter((a) => a.label.trim() && a.matchTerms.trim())
        .map((a) => ({
          id: typeof a.id === 'string' ? a.id : null,
          label: a.label.trim(),
          matchTerms: a.matchTerms.trim(),
          severity: a.severity === 'high' ? 'high' : 'normal',
          sortOrder: typeof a.sortOrder === 'number' ? a.sortOrder : 0,
          isActive: a.isActive !== false,
        }))
    : []

  if (
    Object.keys(data).length === 0 &&
    categoryUpdates.length === 0 &&
    !allergensProvided
  ) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Replace strategy for allergens: any existing row whose ID isn't in the
  // incoming list gets deleted; the rest are upserted by ID.
  const existingAllergens = allergensProvided
    ? await prisma.sM_Allergen.findMany({ select: { id: true } })
    : []
  const incomingIds = new Set(
    allergenInputs.map((a) => a.id).filter((id): id is string => !!id),
  )
  const idsToDelete = existingAllergens
    .map((a) => a.id)
    .filter((id) => !incomingIds.has(id))

  await prisma.$transaction([
    ...(Object.keys(data).length > 0
      ? [
          prisma.sM_Settings.upsert({
            where: { id: 'singleton' },
            create: { id: 'singleton', ...data },
            update: data,
          }),
        ]
      : []),
    ...categoryUpdates.map((c) =>
      prisma.sM_Category.update({
        where: { id: c.id },
        data: { baseIngredients: c.baseIngredients || null },
      }),
    ),
    ...(idsToDelete.length > 0
      ? [
          prisma.sM_Allergen.deleteMany({
            where: { id: { in: idsToDelete } },
          }),
        ]
      : []),
    ...allergenInputs.map((a) =>
      a.id
        ? prisma.sM_Allergen.update({
            where: { id: a.id },
            data: {
              label: a.label,
              matchTerms: a.matchTerms,
              severity: a.severity,
              sortOrder: a.sortOrder,
              isActive: a.isActive,
            },
          })
        : prisma.sM_Allergen.create({
            data: {
              label: a.label,
              matchTerms: a.matchTerms,
              severity: a.severity,
              sortOrder: a.sortOrder,
              isActive: a.isActive,
            },
          }),
    ),
  ])
  return NextResponse.json({ ok: true })
}
