'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/app/lib/prisma'
import { requireAdmin } from '@/app/lib/admin-auth'

export type CampaignActionResult = { ok: true; id?: string } | { ok: false; error: string }

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'party'
}

function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base
  let suffix = 2
  while (await prisma.sM_Campaign.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix++}`
    if (suffix > 200) throw new Error('Could not assign a unique slug')
  }
  return slug
}

export async function createHost(input: {
  name: string
  email?: string
  phone?: string
  payoutNotes?: string
}): Promise<CampaignActionResult> {
  await requireAdmin()
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Host name required' }
  const host = await prisma.sM_Host.create({
    data: {
      name,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      payoutNotes: input.payoutNotes?.trim() || null,
    },
  })
  revalidatePath('/admin/campaigns')
  return { ok: true, id: host.id }
}

export async function createCampaign(input: {
  name: string
  description?: string
  hostId: string
  customerPriceCents: number
  mellyCutCents: number
  variantIds: string[]
  startsAt?: string // ISO
  endsAt?: string
}): Promise<CampaignActionResult> {
  await requireAdmin()
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Campaign name required' }
  if (!input.hostId) return { ok: false, error: 'Pick a host' }
  if (input.customerPriceCents <= 0) {
    return { ok: false, error: 'Customer price must be > $0' }
  }
  if (input.mellyCutCents < 0 || input.mellyCutCents > input.customerPriceCents) {
    return { ok: false, error: "Melly's cut must be between $0 and the customer price" }
  }
  if (input.variantIds.length === 0) {
    return { ok: false, error: 'Pick at least one variant' }
  }

  const slug = await ensureUniqueSlug(slugify(name))
  const campaign = await prisma.sM_Campaign.create({
    data: {
      slug,
      name,
      description: input.description?.trim() || null,
      hostId: input.hostId,
      hostToken: randomToken(),
      customerPriceCents: input.customerPriceCents,
      mellyCutCents: input.mellyCutCents,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      variants: {
        create: input.variantIds.map((variantId) => ({ variantId })),
      },
    },
  })
  revalidatePath('/admin/campaigns')
  return { ok: true, id: campaign.id }
}

export async function updateCampaign(
  id: string,
  input: {
    name?: string
    description?: string | null
    customerPriceCents?: number
    mellyCutCents?: number
    startsAt?: string | null
    endsAt?: string | null
    variantIds?: string[]
  },
): Promise<CampaignActionResult> {
  await requireAdmin()
  const existing = await prisma.sM_Campaign.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Campaign not found' }

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const trimmed = input.name.trim()
    if (!trimmed) return { ok: false, error: 'Campaign name required' }
    data.name = trimmed
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null
  }
  if (input.customerPriceCents !== undefined) {
    if (input.customerPriceCents <= 0) {
      return { ok: false, error: 'Customer price must be > $0' }
    }
    data.customerPriceCents = input.customerPriceCents
  }
  if (input.mellyCutCents !== undefined) {
    const price = data.customerPriceCents ?? existing.customerPriceCents
    if (input.mellyCutCents < 0 || input.mellyCutCents > (price as number)) {
      return { ok: false, error: "Melly's cut must be between $0 and the customer price" }
    }
    data.mellyCutCents = input.mellyCutCents
  }
  if (input.startsAt !== undefined) {
    data.startsAt = input.startsAt ? new Date(input.startsAt) : null
  }
  if (input.endsAt !== undefined) {
    data.endsAt = input.endsAt ? new Date(input.endsAt) : null
  }

  await prisma.$transaction(async (tx) => {
    if (input.variantIds) {
      await tx.sM_CampaignVariant.deleteMany({ where: { campaignId: id } })
      if (input.variantIds.length > 0) {
        await tx.sM_CampaignVariant.createMany({
          data: input.variantIds.map((variantId) => ({
            campaignId: id,
            variantId,
          })),
        })
      }
    }
    await tx.sM_Campaign.update({ where: { id }, data })
  })

  revalidatePath('/admin/campaigns')
  revalidatePath(`/admin/campaigns/${id}`)
  const refreshed = await prisma.sM_Campaign.findUnique({ where: { id } })
  if (refreshed) revalidatePath(`/party/${refreshed.slug}`)
  return { ok: true }
}

export async function setCampaignStatus(
  id: string,
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED',
): Promise<CampaignActionResult> {
  await requireAdmin()
  const existing = await prisma.sM_Campaign.findUnique({
    where: { id },
    include: { variants: true },
  })
  if (!existing) return { ok: false, error: 'Campaign not found' }
  if (status === 'ACTIVE' && existing.variants.length === 0) {
    return { ok: false, error: 'Add at least one variant before activating' }
  }
  await prisma.sM_Campaign.update({ where: { id }, data: { status } })
  revalidatePath('/admin/campaigns')
  revalidatePath(`/admin/campaigns/${id}`)
  revalidatePath(`/party/${existing.slug}`)
  return { ok: true }
}

export async function deleteCampaign(id: string): Promise<CampaignActionResult> {
  await requireAdmin()
  const existing = await prisma.sM_Campaign.findUnique({ where: { id } })
  if (!existing) return { ok: false, error: 'Campaign not found' }
  const orderCount = await prisma.sM_Order.count({ where: { campaignId: id } })
  if (orderCount > 0) {
    return { ok: false, error: `Cannot delete — ${orderCount} order(s) reference this campaign. Close it instead.` }
  }
  await prisma.sM_CampaignVariant.deleteMany({ where: { campaignId: id } })
  await prisma.sM_Campaign.delete({ where: { id } })
  revalidatePath('/admin/campaigns')
  return { ok: true }
}

/** Recycle a lost/leaked host link. Invalidates the old /host/[token] URL. */
export async function rotateHostToken(id: string): Promise<CampaignActionResult> {
  await requireAdmin()
  await prisma.sM_Campaign.update({
    where: { id },
    data: { hostToken: randomToken() },
  })
  revalidatePath(`/admin/campaigns/${id}`)
  return { ok: true }
}
