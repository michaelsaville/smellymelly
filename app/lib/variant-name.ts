// Pure, client-safe variant-name parsing (no server-only deps). Split out of
// scent-resolver.ts so client components (e.g. the orders table) can use it.

// Strip a trailing " - <size>" (e.g. "Lavender - 4oz" -> "Lavender").
// "Peppermint" -> "Peppermint". Keep in sync with the storefront picker.
const SIZE_RE = /^(\d+(?:\.\d+)?)\s*(oz|ml|g|lb)$/i

export function parseVariantScent(variantName: string): string {
  const idx = variantName.lastIndexOf(' - ')
  if (idx >= 0) {
    const tail = variantName.slice(idx + 3).trim()
    if (SIZE_RE.test(tail)) return variantName.slice(0, idx).trim()
  }
  return variantName.trim()
}
