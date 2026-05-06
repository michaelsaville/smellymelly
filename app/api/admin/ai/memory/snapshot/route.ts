import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/app/lib/prisma'

async function checkAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

const SNAPSHOT_PROMPT = `You are reviewing a stored sample of recent messages that Melly has typed to her AI assistant in her admin panel. Your job is to write a short, friendly snapshot for Melly about what patterns the bot is likely picking up from these — so she can sanity-check what the assistant has "learned" about how she writes.

Cover (briefly, only what's actually visible in the data):
- Vocabulary / shorthand she tends to use (specific terms or phrases she repeats)
- The kinds of requests she makes most often (add products? edit prices? ask questions?)
- Her tone (casual, terse, polite, etc.) and any quirks (typos she repeats, units she skips, etc.)
- Anything she should consider pruning from the memory (e.g. one-off rants, irrelevant pasted text, things that might mislead the bot)

Constraints:
- 2 short paragraphs max
- Address Melly directly ("you tend to…", "your messages often…")
- Don't quote the samples verbatim — paraphrase
- If there's not enough signal to say much, say so honestly`

export async function POST() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 },
    )
  }

  const samples = await prisma.sM_AIMessageSample.findMany({
    orderBy: { createdAt: 'asc' },
  })

  if (samples.length < 3) {
    return NextResponse.json({
      summary:
        "Not enough samples yet to spot patterns — keep using the bot for a bit and try again.",
      sampleCount: samples.length,
    })
  }

  const corpus = samples
    .map((s, i) => `${i + 1}. "${s.content.replace(/"/g, "'")}"`)
    .join('\n')

  const client = new Anthropic({ apiKey })
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: SNAPSHOT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Here are the ${samples.length} stored messages, oldest first:\n\n${corpus}`,
        },
      ],
    })
    const summary = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('\n')
      .trim()

    return NextResponse.json({
      summary,
      sampleCount: samples.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[admin/ai/memory/snapshot] error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Snapshot failed' },
      { status: 500 },
    )
  }
}
