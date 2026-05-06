import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { generateScentDescription } from '@/app/lib/scent-descriptions'

// GET — list all active scents with their description (alphabetical).
export async function GET() {
  const scents = await prisma.sM_Scent.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, updatedAt: true },
  })
  return NextResponse.json({ scents })
}

// POST — bulk-generate descriptions for scents that don't have one yet.
// Body: { scope?: "empty" | "all" }  (default "empty")
// Returns { generated: [{id, name, description}], failed: [{id, name, error}] }.
// Sequential to keep request rate gentle on the Anthropic API; for 48 scents
// this finishes in under a minute even at p95 latency.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { scope?: 'empty' | 'all' }
  const scope = body.scope ?? 'empty'

  const scents = await prisma.sM_Scent.findMany({
    where: {
      isActive: true,
      ...(scope === 'empty' ? { description: null } : {}),
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const generated: Array<{ id: string; name: string; description: string }> = []
  const failed: Array<{ id: string; name: string; error: string }> = []

  for (const s of scents) {
    try {
      const description = await generateScentDescription(s.name)
      await prisma.sM_Scent.update({
        where: { id: s.id },
        data: { description },
      })
      generated.push({ id: s.id, name: s.name, description })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      failed.push({ id: s.id, name: s.name, error: msg })
    }
  }

  return NextResponse.json({
    scope,
    total: scents.length,
    generated,
    failed,
  })
}
