import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/app/lib/prisma'

// POST — map a variant scent string to either an existing SM_Scent (creates
// an alias) or a new SM_Scent (creates the scent; alias only created if the
// new scent's canonical name differs from the variant string).
//
// Body shapes:
//   { alias: "Bubblegum", scentId: "<existing>" }
//   { alias: "raspberry sorbert", newScentName: "Raspberry Sorbet" }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as
    | { alias?: string; scentId?: string; newScentName?: string }
    | null
  if (!body || typeof body.alias !== 'string' || !body.alias.trim()) {
    return NextResponse.json({ error: 'alias is required' }, { status: 400 })
  }

  const aliasKey = body.alias.trim().toLowerCase()

  if (body.scentId) {
    // Existing scent — just create the alias.
    const scent = await prisma.sM_Scent.findUnique({
      where: { id: body.scentId },
      select: { id: true, name: true },
    })
    if (!scent) {
      return NextResponse.json({ error: 'scentId not found' }, { status: 404 })
    }
    // Don't create a self-alias when the variant string already equals the
    // canonical name (the resolver matches directly in that case).
    if (aliasKey === scent.name.toLowerCase()) {
      return NextResponse.json({
        ok: true,
        skipped: 'alias matches scent name (already resolves directly)',
      })
    }
    try {
      const created = await prisma.sM_ScentAlias.create({
        data: { alias: aliasKey, scentId: scent.id },
        select: { id: true, alias: true },
      })
      return NextResponse.json({ ok: true, alias: created })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'alias already mapped to another scent' },
          { status: 409 },
        )
      }
      throw e
    }
  }

  if (body.newScentName) {
    const name = body.newScentName.trim()
    if (!name) {
      return NextResponse.json({ error: 'newScentName is empty' }, { status: 400 })
    }
    // If a scent with this name already exists (case-insensitive), reuse it
    // rather than failing on the unique constraint.
    const existing = await prisma.sM_Scent.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    })
    let scent: { id: string; name: string }
    if (existing) {
      scent = existing
    } else {
      const created = await prisma.sM_Scent.create({
        data: { name, isActive: true },
        select: { id: true, name: true },
      })
      scent = created
    }
    // Only create an alias if the variant string differs from the canonical
    // name (otherwise the resolver hits a direct match anyway).
    if (aliasKey !== scent.name.toLowerCase()) {
      try {
        await prisma.sM_ScentAlias.create({
          data: { alias: aliasKey, scentId: scent.id },
        })
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002'
        ) {
          // The alias already points somewhere else; surface the conflict.
          return NextResponse.json(
            { error: 'alias already mapped to another scent' },
            { status: 409 },
          )
        }
        throw e
      }
    }
    return NextResponse.json({ ok: true, scent })
  }

  return NextResponse.json(
    { error: 'either scentId or newScentName is required' },
    { status: 400 },
  )
}
