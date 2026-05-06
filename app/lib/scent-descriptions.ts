import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

// AI-generated scent descriptions. Prompt is tuned for retail copy that
// helps a customer imagine the smell — not technical perfumery jargon.
// ~30-60 words, evocative, ASCII safe (the printed paper form runs the
// text through plain HTML).

const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = [
  'You write short, evocative scent descriptions for a small handmade bath-and-body shop.',
  'Audience: in-store customers picking up a sniff stick or paper sample. They want to imagine the smell before buying.',
  'Voice: warm, plain-spoken, sensory. Avoid perfumery jargon ("middle notes", "accord", "sillage") — use everyday words.',
  'Constraints:',
  '- Length: 30-60 words. One paragraph. No headings, no bullet lists.',
  '- Lead with the dominant impression, then the supporting notes, then a vibe word ("cozy", "fresh", "uplifting").',
  '- ASCII characters only. No em dashes, curly quotes, or accented letters — the paper form font has limited glyphs.',
  '- Do not invent ingredients. If the name is ambiguous (e.g. "Spring Rain"), describe the impression of the name, not a literal recipe.',
  '- Do not start with the scent name; the customer already sees the name above the description.',
  '- No marketing fluff ("amazing!", "must-have"); let the imagery do the work.',
].join('\n')

export async function generateScentDescription(scentName: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }
  const client = new Anthropic({ apiKey })
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Write the scent description for: "${scentName}"`,
      },
    ],
  })
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim()
  if (!text) throw new Error('AI returned an empty description')
  return stripNonAscii(text)
}

function stripNonAscii(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}
