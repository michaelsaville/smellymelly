/**
 * Unit conversion for recipe cost calculations.
 *
 * Supported units grouped by type:
 *   Weight:  oz, g, lb, kg
 *   Volume:  fl_oz, ml, L, cups, tbsp, tsp
 *   Other:   drops, count
 *
 * Cross-type conversion (e.g. oz → ml) is not supported — materials
 * and recipe items must use the same unit type.
 */

// Everything converts through a base unit per type:
//   Weight → grams
//   Volume → ml
//   drops/count → themselves (no conversion)

const TO_GRAMS: Record<string, number> = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
  kg: 1000,
}

const TO_ML: Record<string, number> = {
  ml: 1,
  fl_oz: 29.5735,
  L: 1000,
  cups: 236.588,
  tbsp: 14.7868,
  tsp: 4.92892,
}

const IDENTITY: Record<string, number> = {
  drops: 1,
  count: 1,
}

function factor(unit: string): { base: number; group: string } {
  if (unit in TO_GRAMS) return { base: TO_GRAMS[unit], group: 'weight' }
  if (unit in TO_ML) return { base: TO_ML[unit], group: 'volume' }
  if (unit in IDENTITY) return { base: 1, group: unit }
  throw new Error(`Unknown unit: ${unit}`)
}

/**
 * Convert `qty` from `fromUnit` to `toUnit`.
 * Throws if the units are in different groups (e.g. weight vs volume).
 */
export function convert(qty: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return qty
  const from = factor(fromUnit)
  const to = factor(toUnit)
  if (from.group !== to.group) {
    throw new Error(`Cannot convert ${fromUnit} (${from.group}) to ${toUnit} (${to.group})`)
  }
  return (qty * from.base) / to.base
}

/**
 * Calculate cost of using `useQty` of `useUnit` when the material
 * was purchased as `pkgSize` of `pkgUnit` for `pkgCostCents`.
 * Returns cost in cents (fractional).
 */
export function materialItemCost(
  pkgCostCents: number,
  pkgSize: number,
  pkgUnit: string,
  useQty: number,
  useUnit: string,
): number {
  const useInPkgUnit = convert(useQty, useUnit, pkgUnit)
  const costPerPkgUnit = pkgCostCents / pkgSize
  return costPerPkgUnit * useInPkgUnit
}

/** Human-readable label for a unit code */
export const UNIT_LABELS: Record<string, string> = {
  oz: 'oz',
  g: 'g',
  lb: 'lb',
  kg: 'kg',
  fl_oz: 'fl oz',
  ml: 'mL',
  L: 'L',
  cups: 'cups',
  tbsp: 'tbsp',
  tsp: 'tsp',
  drops: 'drops',
  count: 'count',
}

export const UNIT_OPTIONS = Object.entries(UNIT_LABELS).map(([value, label]) => ({
  value,
  label,
}))
