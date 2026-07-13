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

  const shippingCents =
    input.fulfillment === 'SHIP'
      ? input.shippingCentsOverride && input.shippingCentsOverride > 0
        ? input.shippingCentsOverride
        : SHIPPING_CENTS
      : 0
  const taxCents = Math.round(subtotalCents * taxRate)
  const totalCents = subtotalCents + shippingCents + taxCents

  return {
    ok: true,
    data: {
      orderItems,
      rawSubtotalCents,
      wholesaleDiscountCents,
      subtotalCents,
      shippingCents,
      taxCents,
      totalCents,
    },
  }
}
