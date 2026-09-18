'use server'

/**
 * Card-present payments taken by the Stripe Reader M2 over Bluetooth, from
 * inside the native POS shell (NATIVE-POS-SHELL.md).
 *
 * Why this exists alongside terminal.ts: the M2 is a *mobile* reader. It is
 * compatible with the iOS/Android/React Native Terminal SDKs only — there is
 * no JS SDK support and no server-driven API support, and iOS Safari has no
 * Web Bluetooth at all, so the browser can never speak to it. Only Stripe's
 * smart readers (WisePOS E, S700/S710, Verifone) can be driven the way
 * terminal.ts does it.
 *
 * So the split of labour is: this server mints the PaymentIntent, the browser
 * hands the client secret across the JS bridge, and the native side does
 * retrieve -> collect -> confirm against the reader. The browser never sees
 * card data and this server never sees it either — same PCI SAQ-A posture as
 * the keyed path, for a different reason.
 *
 * Both readers can coexist: terminal.ts stays the path for a smart reader if
 * one is ever added, and the POS prefers whichever is actually present.
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
 * Mint a card_present PaymentIntent and hand back the client secret for the
 * SDK to retrieve.
 *
 * capture_method is 'automatic' for the same reason terminal.ts chose it:
 * this is retail, paid in hand, and a manual authorisation silently expires
 * after 2 days if anything goes wrong between the tap and the capture. With
 * automatic capture a successful confirmPaymentIntent lands on 'succeeded'
 * and there is no capture step for the shell to drop on the floor.
 *
 * amountCents comes from the client, matching startTerminalPayment and
 * startKeyedCardPayment — the only caller is Mel behind the admin cookie and
 * a POS total is whatever she rings up, so there is no independent truth to
 * check it against. createPosSale still recomputes the ORDER totals itself.
 *
 * ⚠ One PaymentIntent per *sale*, not per attempt. If the card declines, the
 * shell must re-run collectPaymentMethod against this same intent rather than
 * calling back here for a fresh one — a second intent is a second
 * authorisation on the customer's card.
 */
export async function startSdkCardPayment(input: {
  amountCents: number
}): Promise<Result<{ clientSecret: string; paymentIntentId: string }>> {
  await requireAdmin()
  if (!isStripeConfigured()) {
    return { ok: false, error: 'Stripe is not configured yet.' }
  }
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return { ok: false, error: 'Nothing to charge.' }
  }
  // Stripe rejects card-present charges under $0.50.
  if (input.amountCents < 50) {
    return { ok: false, error: 'Card payments must be at least $0.50. Take this one in cash.' }
  }

  try {
    const intent = await getStripe().paymentIntents.create({
      amount: input.amountCents,
      currency: 'usd',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      description: 'Smelly Melly — sale at the till',
      // No receipt_email: the POS sends its own receipt once the order exists.
      // A Stripe one would arrive first, with no order number, and read to the
      // customer like a second charge.
      metadata: { source: 'pos-m2' },
    })

    if (!intent.client_secret) {
      return { ok: false, error: 'Stripe did not return a usable payment. Try again.' }
    }
    return { ok: true, clientSecret: intent.client_secret, paymentIntentId: intent.id }
  } catch (err) {
    console.error('[pos-sdk-card]', err)
    const msg = (err as { message?: string })?.message
    return { ok: false, error: msg || 'Could not start the card payment.' }
  }
}

/**
 * Void an intent the reader never charged — Mel backing out, or the shell
 * failing before confirm. Best-effort and deliberately forgiving: if the tap
 * landed in the race, the intent is left alone so the sale can still be
 * completed rather than the money being taken with no order to show for it.
 */
export async function cancelSdkCardPayment(paymentIntentId: string): Promise<Result> {
  await requireAdmin()
  if (!isStripeConfigured()) return { ok: true }
  try {
    const stripe = getStripe()
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (intent.status !== 'succeeded' && intent.status !== 'requires_capture') {
      await stripe.paymentIntents.cancel(paymentIntentId).catch(() => {})
    }
    return { ok: true }
  } catch (err) {
    console.error('[pos-sdk-card:cancel]', err)
    return { ok: false, error: 'Could not cancel cleanly — check the reader.' }
  }
}
