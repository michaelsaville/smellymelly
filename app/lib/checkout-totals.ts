import { prisma } from '@/app/lib/prisma'

/**
 * Single source of truth for checkout money math. Used by BOTH the
 * PaymentIntent route (to charge the right amount) and the order-creation
 * route (to persist the same amount) so the two can never disagree.
 *
 * Order of operations (matches the original inline logic): line subtotal →
 * wholesale discount (before tax/shipping) → tax on the discounted subtotal →
 * shipping added last.
 */

export const SHIPPING_CENTS = 599

export interface CheckoutItemInput {
  variantId: string
  quantity: number
}

export interface ComputeInput {
  items: CheckoutItemInput[]
  fulfillment: 'SHIP' | 'PICKUP'
  email: string
  shippingCentsOverride?: number
  /** Storefront promo code entered at checkout (case-insensitive). */
  discountCode?: string
}

export interface ComputedOrderItem {
  variantId: string
  productName: string
  variantName: string
  quantity: number
  unitCents: number
  totalCents: number
}

export interface ComputeResult {
  orderItems: ComputedOrderItem[]
  rawSubtotalCents: number
  wholesaleDiscountCents: number
  subtotalCents: number
  /** Promo-code amount taken off the (post-wholesale) merchandise subtotal. */
  discountCents: number
  /** Normalized (uppercased) promo code that was applied, or null. */
  discountCode: string | null
  /** Id of the applied SM_DiscountCode row — used to bump usedCount post-payment. */
  discountCodeId: string | null
  shippingCents: number
  taxCents: number
  totalCents: number
}

export type ComputeOutcome =
  | { ok: true; data: ComputeResult }
  | { ok: false; error: string; status: number }

export async function computeCheckout(input: ComputeInput): Promise<ComputeOutcome> {
  if (!input.items?.length) {
    return { ok: false, error: 'Cart is empty.', status: 400 }
  }

  const variantIds = input.items.map((i) => i.variantId)
  const variants = await prisma.sM_ProductVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: { product: true },
  })
  const variantMap = new Map(variants.map((v) => [v.id, v]))

  const orderItems: ComputedOrderItem[] = []
  for (const item of input.items) {
    const variant = variantMap.get(item.variantId)
    if (!variant) {
      return { ok: false, error: `Product variant not found: ${item.variantId}`, status: 400 }
    }
    if (item.quantity < 1) {
      return { ok: false, error: 'Quantity must be at least 1.', status: 400 }
    }
    if (variant.stockQuantity < item.quantity) {
      return {
        ok: false,
        error: `Not enough stock for "${variant.name}". Available: ${variant.stockQuantity}`,
        status: 400,
      }
    }
    orderItems.push({
      variantId: variant.id,
      productName: variant.product.name,
      variantName: variant.name,
      quantity: item.quantity,
      unitCents: variant.priceCents,
      totalCents: variant.priceCents * item.quantity,
    })
  }

  const settings = await prisma.sM_Settings.findFirst({ where: { id: 'singleton' } })
  const taxRate = settings?.taxRate ?? 0.06

  const rawSubtotalCents = orderItems.reduce((sum, i) => sum + i.totalCents, 0)

  // Wholesale discount — email match is case-insensitive (SM_Customer stores
  // lowercased). Applied before tax and shipping.
  const existingCustomer = await prisma.sM_Customer.findUnique({
    where: { email: input.email.trim().toLowerCase() },
    select: { wholesaleDiscountPct: true },
  })
  const wholesalePct = existingCustomer?.wholesaleDiscountPct ?? 0
  const wholesaleDiscountCents =
    wholesalePct > 0 ? Math.round((rawSubtotalCents * wholesalePct) / 100) : 0
  const subtotalCents = rawSubtotalCents - wholesaleDiscountCents

  // Promo/discount code — applied on the post-wholesale merchandise subtotal,
  // before tax and shipping. An invalid code is a hard error so we never charge
  // a total the buyer didn't agree to (they applied it moments earlier).
  let discountCents = 0
  let discountCode: string | null = null
  let discountCodeId: string | null = null
  const rawCode = input.discountCode?.trim().toUpperCase()
  if (rawCode) {
    const promo = await prisma.sM_DiscountCode.findUnique({ where: { code: rawCode } })
    const invalid = promoValidationError(promo, subtotalCents)
    if (invalid) return { ok: false, error: invalid, status: 400 }
    // promo is non-null here (promoValidationError returns a message otherwise)
    const p = promo!
    const gross =
      p.type === 'PERCENT'
        ? Math.round((subtotalCents * p.value) / 100)
        : p.value
    discountCents = Math.min(Math.max(0, gross), subtotalCents)
    discountCode = p.code
    discountCodeId = p.id
  }

  const taxableCents = subtotalCents - discountCents

  const shippingCents =
    input.fulfillment === 'SHIP'
      ? input.shippingCentsOverride && input.shippingCentsOverride > 0
        ? input.shippingCentsOverride
        : SHIPPING_CENTS
      : 0
  const taxCents = Math.round(taxableCents * taxRate)
  const totalCents = taxableCents + shippingCents + taxCents

  return {
    ok: true,
    data: {
      orderItems,
      rawSubtotalCents,
      wholesaleDiscountCents,
      subtotalCents,
      discountCents,
      discountCode,
      discountCodeId,
      shippingCents,
      taxCents,
      totalCents,
    },
  }
}

type PromoRow = {
  isActive: boolean
  maxUses: number
  usedCount: number
  minSubtotalCents: number
  expiresAt: Date | null
} | null

/**
 * Returns a human-readable reason the promo can't be applied, or null if it's
 * valid for the given post-wholesale subtotal. Shared by the checkout math and
 * the /validate-code preview endpoint so the two never disagree.
 */
export function promoValidationError(promo: PromoRow, subtotalCents: number): string | null {
  if (!promo) return 'That promo code was not found.'
  if (!promo.isActive) return 'That promo code is no longer active.'
  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
    return 'That promo code has expired.'
  }
  if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) {
    return 'That promo code has reached its usage limit.'
  }
  if (promo.minSubtotalCents > 0 && subtotalCents < promo.minSubtotalCents) {
    return `Add $${(promo.minSubtotalCents / 100).toFixed(2)} in products to use this code.`
  }
  return null
}
