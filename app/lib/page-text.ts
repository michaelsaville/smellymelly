import 'server-only'
import { prisma } from '@/app/lib/prisma'

/**
 * Editable copy blocks for public pages. The keys here are the full
 * registry — adding a new editable block is a code change:
 *
 *   1. Add the key + fallback text to PAGE_TEXT_REGISTRY below
 *   2. Replace the hardcoded text in the page component with
 *      `await getPageText('your.key')`
 *   3. `/admin/copy` picks it up automatically from the registry
 *
 * Fallbacks are what ships in code; a row in SM_PageText overrides them.
 * If a row is missing or the DB is unreachable, the fallback is used —
 * the page never renders empty.
 */

export interface PageTextField {
  key: string
  label: string
  group: string
  /** Rendering hint for the admin form — short gets an input, long gets
   *  a textarea, list gets a taller textarea with "one item per line"
   *  guidance. */
  kind: 'short' | 'long' | 'list'
  fallback: string
  hint?: string
}

export const PAGE_TEXT_REGISTRY: readonly PageTextField[] = [
  // ── About page ──────────────────────────────────────────────────────
  {
    group: 'About page',
    key: 'about.hero_subtitle',
    label: 'Hero subtitle (under the page title)',
    kind: 'short',
    fallback: 'Handmade with love in Cumberland, Maryland',
  },
  {
    group: 'About page',
    key: 'about.intro',
    label: 'Intro paragraph',
    kind: 'long',
    fallback:
      "Hi there, I'm Mel! What started as a kitchen hobby has turned into a full-time love affair with good scent. Every jar, every tube, every little package of wax melts is made by hand, in small batches, right here in Cumberland.",
  },
  {
    group: 'About page',
    key: 'about.list_lead',
    label: 'List lead-in',
    kind: 'short',
    fallback: "Here's what you'll find on the shelves:",
  },
  {
    group: 'About page',
    key: 'about.list_items',
    label: 'What you make (one bullet per line)',
    kind: 'list',
    hint: 'Each line becomes its own bullet on the About page.',
    fallback: [
      'Body butter in 4 oz and 8 oz jars — scents from cozy to playful to grown-up',
      "Body scrubs that leave your skin soft without a chemistry-class ingredient list",
      'Bath salts for long soaks on the days you need one',
      "Wax melts and room fragrance sprays so your house smells like something you actually want to come home to",
      'Lip balm in a handful of flavors — Peppermint, Spearmint',
    ].join('\n'),
  },
  {
    group: 'About page',
    key: 'about.middle',
    label: 'Middle paragraph (ingredients / inspiration)',
    kind: 'long',
    fallback:
      "I stick to natural oils, butters, and skin-safe fragrance — nothing you can't pronounce, nothing you don't need. The scents range from cozy to bright to grown-up — think Lavender, Strawberry Pound Cake, and Mahogany & Teakwood.",
  },
  {
    group: 'About page',
    key: 'about.quote',
    label: 'Featured quote',
    kind: 'short',
    fallback: 'Every jar made small. Every scent made to matter.',
  },
  {
    group: 'About page',
    key: 'about.quote_author',
    label: 'Quote author',
    kind: 'short',
    fallback: 'Mel',
  },
  {
    group: 'About page',
    key: 'about.closing',
    label: 'Closing paragraph',
    kind: 'long',
    fallback:
      "Every order is packed by me. If you're picking up through a fundraiser host, I hand the bundle to them — if you're ordering online, it goes straight to the post office. Either way, if something isn't right when it lands, tell me and I'll make it right.",
  },
  {
    group: 'About page',
    key: 'about.contact_nudge',
    label: 'Contact nudge (below the story)',
    kind: 'long',
    fallback:
      'Questions, custom scent requests, wholesale or party hosting? Drop me a line — I\u2019d love to hear from you.',
  },
] as const

const FALLBACKS: Record<string, string> = Object.fromEntries(
  PAGE_TEXT_REGISTRY.map((f) => [f.key, f.fallback]),
)

export function fallbackFor(key: string): string {
  return FALLBACKS[key] ?? ''
}

/** Read a single copy block, DB first with code fallback. */
export async function getPageText(key: string): Promise<string> {
  const fallback = fallbackFor(key)
  try {
    const row = await prisma.sM_PageText.findUnique({ where: { key } })
    return row?.value ?? fallback
  } catch (err) {
    console.error(`[page-text] read for "${key}" failed, using fallback:`, err)
    return fallback
  }
}

/** Batch read — one round-trip for a page with several blocks. */
export async function getPageTextMany(
  keys: readonly string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const k of keys) out[k] = fallbackFor(k)
  try {
    const rows = await prisma.sM_PageText.findMany({
      where: { key: { in: [...keys] } },
    })
    for (const r of rows) out[r.key] = r.value
  } catch (err) {
    console.error('[page-text] batch read failed, using fallbacks:', err)
  }
  return out
}
