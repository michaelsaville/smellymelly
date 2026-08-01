'use server'

/**
 * Stripe Terminal — card-present payments at markets.
 *
 * Why this shape: Mel works from a cellular iPad, and an iPad cannot accept
 * contactless taps itself (Apple's Tap to Pay is iPhone-only). So a physical
 * smart reader is required. Of the three ways to drive one:
 *
 *   - Bluetooth readers need a native iOS SDK  -> blocked, no Mac/Apple acct.
 *   - The Terminal JS SDK needs the iPad and reader on the SAME LAN with
 *     working local DNS -> miserable at an outdoor market.
 *   - The server-driven API talks to the reader over the internet through
 *     Stripe -> works from a plain web POS, which is what we have.
 *
 * So: the browser calls these actions, this server calls Stripe, and Stripe
 * relays to the reader. The reader needs its own internet (join the iPad's
 * Personal Hotspot); it does not need to see the iPad directly.
 *
 * Trade-off accepted: server-driven cannot take payments while offline. That
 * costs us nothing here because the POS itself can't complete ANY sale
 * offline — the service worker never caches /api/*, and every sale is a
 * server action.
 */

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type Stripe from 'stripe'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'
import { prisma } from '@/app/lib/prisma'

async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies()
  if (cookieStore.get('sm_admin')?.value !== 'sm_authenticated') {
    throw new Error('Unauthorized')
  }
}

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string }

/** Terminal errors are Mel-facing at the till, so keep them plain. */
function toError(err: unknown, fallback: string): { ok: false; error: string } {
  const msg = (err as { message?: string })?.message
  console.error('[terminal]', err)
  return { ok: false, error: msg || fallback }
}

async function getReaderId(): Promise<string | null> {
  const s = await prisma.sM_Settings.findUnique({
    where: { id: 'singleton' },
    select: { terminalReaderId: true },
  })
  return s?.terminalReaderId || null
}

/** Readers registered on the Stripe account, for the settings picker. */
export async function listTerminalReaders(): Promise<
  Result<{ readers: { id: string; label: string; status: string; deviceType: string }[] }>
> {
  await requireAdmin()
  if (!isStripeConfigured()) {
    return { ok: false, error: 'Stripe is not configured yet.' }
  }
  try {
    const res = await getStripe().terminal.readers.list({ limit: 100 })
    return {
      ok: true,
      readers: res.data.map((r) => ({
        id: r.id,
        label: r.label || r.id,
        status: r.status || 'unknown',
        deviceType: r.device_type || '',
      })),
    }
  } catch (err) {
    return toError(err, 'Could not reach Stripe to list readers.')
  }
}

export async function saveTerminalReader(
  readerId: string,
  label: string,
): Promise<Result> {
  await requireAdmin()
  try {
    await prisma.sM_Settings.update({
      where: { id: 'singleton' },
      data: {
        terminalReaderId: readerId.trim() || null,
        terminalReaderLabel: readerId.trim() ? label.trim() || readerId.trim() : null,
      },
    })
    revalidatePath('/admin/settings')
    revalidatePath('/admin/pos')
    return { ok: true }
  } catch (err) {
    return toError(err, 'Could not save the reader.')
  }
}

/**
 * Push a charge to the reader. Returns as soon as the reader has been handed
 * the PaymentIntent — the customer has not tapped yet, so the caller must
 * poll checkTerminalPayment().
 *
 * capture_method is 'automatic': this is retail, paid in hand, and a manual
 * authorisation would silently expire after 2 days if anything went wrong
 * between the tap and the capture.
 */
export async function startTerminalPayment(input: {
  amountCents: number
}): Promise<Result<{ paymentIntentId: string }>> {
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

  const readerId = await getReaderId()
  if (!readerId) {
    return { ok: false, error: 'No card reader is set up yet. Add one in Settings.' }
  }

  const stripe = getStripe()
  let intent: Stripe.PaymentIntent
  try {
    intent = await stripe.paymentIntents.create({
      amount: input.amountCents,
      currency: 'usd',
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
    })
  } catch (err) {
    return toError(err, 'Could not start the card payment.')
  }

  try {
    await stripe.terminal.readers.processPaymentIntent(readerId, {
      payment_intent: intent.id,
      // Let the customer back out on the reader itself rather than making Mel
      // reach over and cancel from the iPad.
      process_config: { enable_customer_cancellation: true },
    })
  } catch (err) {
    // The reader never took the job, so nothing can be charged against this
    // intent — cancel it rather than leaving a stray open PaymentIntent.
    await stripe.paymentIntents.cancel(intent.id).catch(() => {})
    return toError(err, 'The reader did not respond. Check that it is on and online.')
  }

  return { ok: true, paymentIntentId: intent.id }
}

/**
 * Poll for the outcome. The PaymentIntent is the authority on whether money
 * moved; the reader action is only consulted to surface a decline reason.
 */
export async function checkTerminalPayment(
  paymentIntentId: string,
): Promise<Result<{ state: 'pending' | 'succeeded' | 'failed'; message?: string }>> {
  await requireAdmin()
  const stripe = getStripe()
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (intent.status === 'succeeded' || intent.status === 'requires_capture') {
      return { ok: true, state: 'succeeded' }
    }
    if (intent.status === 'canceled') {
      return { ok: true, state: 'failed', message: 'Payment cancelled.' }
    }

    // Still open on Stripe's side. A failed tap leaves the intent open for a
    // retry, so the decline reason lives on the reader action, not the intent.
    const readerId = await getReaderId()
    if (readerId) {
      const reader = await stripe.terminal.readers.retrieve(readerId)
      const action = (reader as Stripe.Terminal.Reader).action
      if (action?.status === 'failed') {
        return {
          ok: true,
          state: 'failed',
          message: action.failure_message || 'The card was declined.',
        }
      }
    }
    return { ok: true, state: 'pending' }
  } catch (err) {
    return toError(err, 'Lost contact with Stripe while waiting on the card.')
  }
}

/** Mel backing out from the iPad. Best-effort: a tap already in flight wins. */
export async function cancelTerminalPayment(
  paymentIntentId?: string,
): Promise<Result> {
  await requireAdmin()
  const stripe = getStripe()
  const readerId = await getReaderId()
  try {
    if (readerId) {
      await stripe.terminal.readers.cancelAction(readerId).catch(() => {})
    }
    if (paymentIntentId) {
      // Only cancel an intent that hasn't taken money. If the tap landed in
      // the race, leave it alone so the sale can still be completed.
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
      if (intent.status !== 'succeeded' && intent.status !== 'requires_capture') {
        await stripe.paymentIntents.cancel(paymentIntentId).catch(() => {})
      }
    }
    return { ok: true }
  } catch (err) {
    return toError(err, 'Could not cancel cleanly — check the reader screen.')
  }
}
