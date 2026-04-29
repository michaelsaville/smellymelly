// Common allergens / ingredients-of-concern in handmade bath & body.
// Detected by case-insensitive substring match against the combined
// category baseIngredients + per-product ingredients text. Only matched
// pills render on the product page — we never claim absence.

interface AllergenPill {
  label: string
  patterns: RegExp[]
}

const ALLERGEN_PILLS: AllergenPill[] = [
  { label: 'Shea', patterns: [/\bshea\b/i] },
  { label: 'Mango butter', patterns: [/\bmango\b/i] },
  { label: 'Coconut', patterns: [/\bcoconut\b/i] },
  { label: 'Almond', patterns: [/\balmond\b/i] },
  { label: 'Cocoa butter', patterns: [/\bcocoa\b/i] },
  { label: 'Argan', patterns: [/\bargan\b/i] },
  { label: 'Jojoba', patterns: [/\bjojoba\b/i] },
  { label: 'Beeswax', patterns: [/\bbees?wax\b/i] },
  { label: 'Soy', patterns: [/\bsoy\b/i] },
  { label: 'Fragrance', patterns: [/\bfragrance\b/i] },
  { label: 'Essential oils', patterns: [/\bessential oil/i] },
  { label: 'Flavor oil', patterns: [/\bflavor oil/i] },
]

export function detectAllergens(
  ...sources: (string | null | undefined)[]
): string[] {
  const text = sources.filter((s): s is string => !!s).join(' ')
  if (!text) return []
  return ALLERGEN_PILLS.filter((p) =>
    p.patterns.some((re) => re.test(text)),
  ).map((p) => p.label)
}
