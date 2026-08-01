'use server'

/**
 * Keyed card entry at the till — the stand-in for a Stripe Terminal reader.
 *
 * This is card-NOT-present: the number is typed (or camera-scanned) into a
 * Stripe Payment Element, so the digits live in Stripe's iframe and never
 * reach this server, which keeps us at PCI SAQ-A exactly like /checkout.
 *
 * It costs more than the reader (card-not-present pricing) and puts
 * chargeback liability on us, so once a reader is registered the POS prefers
 * it and treats this as the fallback for a card that won't read.
 */

import { cookies } from 'next/headers'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * Mint a PaymentIntent for the card leg of a POS sale and hand back the
 * client secret so the browser can confirm it in-page.
 *
 * The amount comes from the client, unlike /api/checkout/payment-intent which
 * recomputes a cart total it doesn't trust. That's deliberate and matches
 * startTerminalPayment: the only caller is Mel behind the admin cookie, and a
 * POS total is whatever she rings up — there is no independent truth to check
 * it against. createPosSale still recomputes the ORDER totals on its own; this
 * value only decides what the card is charged.
 */
export async function startKeyedCardPayment(input: {
  amountCents: number
}): Promise<Result<{ clientSecret: string }>> {
  await requireAdmin()
  if (!isStripeConfigured()) {
    return { ok: false, error: 'Stripe is not configured yet.' }
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'Nothing to charge.' }
  }
  if (input.amountCents < 50) {
    return { ok: false, error: 'Card payments must be at least $0.50. Take this one in cash.' }
  }

  try {
    const intent = await getStripe().paymentIntents.create({
      amount: input.amountCents,
      currency: 'usd',
      // Same shape as checkout: wallets and cards confirm in-page, and no
      // redirect method can yank Mel out of the till mid-sale.
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: 'Smelly Melly — sale at the till',
      // Deliberately no receipt_email: the POS sends its own receipt after the
      // order exists, and a Stripe one here would arrive first, without an
      // order number, and read like a second charge.
      metadata: { source: 'pos-keyed' },
    })

    if (!intent.client_secret) {
      return { ok: false, error: 'Stripe did not return a usable payment. Try again.' }
    }
    return { ok: true, clientSecret: intent.client_secret }
  } catch (err) {
    console.error('[pos-card]', err)
    const msg = (err as { message?: string })?.message
    return { ok: false, error: msg || 'Could not start the card payment.' }
  }
}
