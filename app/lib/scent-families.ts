// Scent Finder: classify scents into fragrance families by keyword (over the
// scent name + its customer description) so we can recommend without requiring
// Mel to hand-tag every scent. Pure/shared — no prisma, no server-only.

export type FamilyKey = 'fresh' | 'citrus' | 'floral' | 'sweet' | 'fruity' | 'warm' | 'herbal'

export const SCENT_FAMILIES: Record<FamilyKey, { label: string; keywords: string[] }> = {
  fresh: {
    label: 'Fresh & Clean',
    keywords: ['linen', 'cotton', 'fresh', 'clean', 'ocean', 'sea', 'rain', 'cucumber', 'aloe', 'mint', 'eucalyptus', 'breeze', 'air', 'cool', 'water', 'marine', 'bamboo', 'snow', 'crisp'],
  },
  citrus: {
    label: 'Citrus & Bright',
    keywords: ['lemon', 'lime', 'orange', 'citrus', 'grapefruit', 'bergamot', 'mandarin', 'tangerine', 'zest', 'verbena'],
  },
  floral: {
    label: 'Floral & Pretty',
    keywords: ['rose', 'floral', 'flower', 'jasmine', 'lavender', 'lilac', 'gardenia', 'peony', 'violet', 'magnolia', 'honeysuckle', 'lily', 'freesia', 'blossom', 'iris', 'tulip'],
  },
  sweet: {
    label: 'Sweet & Cozy',
    keywords: ['vanilla', 'sugar', 'cake', 'cookie', 'caramel', 'honey', 'marshmallow', 'buttercream', 'cotton candy', 'chocolate', 'coffee', 'toffee', 'maple', 'birthday', 'creme', 'cream', 'sweet', 'praline'],
  },
  fruity: {
    label: 'Fruity & Fun',
    keywords: ['berry', 'strawberry', 'peach', 'apple', 'cherry', 'mango', 'coconut', 'watermelon', 'pear', 'raspberry', 'blackberry', 'pineapple', 'grape', 'plum', 'guava', 'melon', 'banana', 'fig', 'currant'],
  },
  warm: {
    label: 'Warm & Woody',
    keywords: ['amber', 'sandalwood', 'cedar', 'wood', 'musk', 'patchouli', 'cinnamon', 'clove', 'spice', 'tobacco', 'leather', 'oud', 'teakwood', 'mahogany', 'pumpkin', 'chai', 'nutmeg', 'fireside', 'smoke', 'bourbon', 'whiskey', 'oak', 'balsam'],
  },
  herbal: {
    label: 'Herbal & Earthy',
    keywords: ['sage', 'herb', 'tea', 'green', 'basil', 'rosemary', 'thyme', 'grass', 'moss', 'fern', 'garden', 'botanical', 'lemongrass', 'vetiver'],
  },
}

export function classifyScent(name: string, description?: string | null): FamilyKey[] {
  const text = `${name} ${description ?? ''}`.toLowerCase()
  const hits: FamilyKey[] = []
  for (const key of Object.keys(SCENT_FAMILIES) as FamilyKey[]) {
    if (SCENT_FAMILIES[key].keywords.some((k) => text.includes(k))) hits.push(key)
  }
  return hits
}

// ── The quiz ─────────────────────────────────────────────────────────────

export type QuizOption = { label: string; emoji: string; weights: Partial<Record<FamilyKey, number>> }
export type QuizQuestion = { id: string; question: string; options: QuizOption[] }

export const QUIZ: QuizQuestion[] = [
  {
    id: 'vibe',
    question: 'What kind of scent are you drawn to?',
    options: [
      { label: 'Fresh & clean', emoji: '🌿', weights: { fresh: 3, citrus: 1, herbal: 1 } },
      { label: 'Warm & cozy', emoji: '🔥', weights: { warm: 3, sweet: 2 } },
      { label: 'Sweet & fruity', emoji: '🍓', weights: { sweet: 2, fruity: 3 } },
      { label: 'Floral & pretty', emoji: '🌸', weights: { floral: 3 } },
    ],
  },
  {
    id: 'mood',
    question: 'What mood are you going for?',
    options: [
      { label: 'Relax & unwind', emoji: '🧖‍♀️', weights: { floral: 2, herbal: 2, fresh: 1 } },
      { label: 'Bright & energized', emoji: '☀️', weights: { citrus: 3, fresh: 2 } },
      { label: 'Cozy & comforting', emoji: '☕', weights: { warm: 2, sweet: 3 } },
      { label: 'Playful & fun', emoji: '🎉', weights: { fruity: 3, sweet: 1 } },
    ],
  },
  {
    id: 'for',
    question: 'Who is it for?',
    options: [
      { label: 'Treat myself', emoji: '💆', weights: {} },
      { label: 'A gift', emoji: '🎁', weights: {} },
      { label: 'Surprise me!', emoji: '✨', weights: {} },
    ],
  },
]

// Sum the family weights across chosen options (answers keyed by question id → option index).
export function scoreFamilies(answers: Record<string, number>): Record<FamilyKey, number> {
  const totals = { fresh: 0, citrus: 0, floral: 0, sweet: 0, fruity: 0, warm: 0, herbal: 0 }
  for (const q of QUIZ) {
    const idx = answers[q.id]
    const opt = q.options[idx]
    if (!opt) continue
    for (const key of Object.keys(opt.weights) as FamilyKey[]) {
      totals[key] += opt.weights[key] ?? 0
    }
  }
  return totals
}
