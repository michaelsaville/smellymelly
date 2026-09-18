/**
 * Browser half of the bridge to the native POS shell (NATIVE-POS-SHELL.md).
 *
 * The register runs inside a WKWebView in a thin Swift app whose only job is
 * to drive the Stripe Reader M2 over Bluetooth — the M2 speaks to the Terminal
 * iOS SDK and nothing else, so this is the only way a web POS can reach it.
 * Outside that shell every function here degrades to "no native reader" and
 * the POS falls back to the smart-reader or keyed paths exactly as before.
 *
 * Protocol, both directions, deliberately tiny:
 *
 *   web -> native   window.webkit.messageHandlers.smPay.postMessage(
 *                     { id, action: 'collect', clientSecret, amountCents })
 *                     { id, action: 'cancel' }
 *
 *   native -> web   window.smPayEvent({ type: 'reader', label })
 *                   window.smPayEvent({ type: 'status', id, message })
 *                   window.smPayEvent({ type: 'result', id, ok, paymentIntentId? , error? })
 *
 * The shell also sets window.smPayNative = { version: 1 } at document start,
 * which is how we know we're inside it before any message is exchanged.
 */

export type NativeReaderEvent =
  | { type: 'reader'; label: string | null }
  | { type: 'status'; id: string; message: string }
  | { type: 'result'; id: string; ok: true; paymentIntentId: string }
  | { type: 'result'; id: string; ok: false; error: string }

type Pending = {
  resolve: (r: { ok: true; paymentIntentId: string } | { ok: false; error: string }) => void
  onStatus?: (message: string) => void
}

declare global {
  interface Window {
    smPayNative?: { version: number }
    smPayEvent?: (e: NativeReaderEvent) => void
    webkit?: {
      messageHandlers?: {
        smPay?: { postMessage: (msg: unknown) => void }
      }
    }
  }
}

const pending = new Map<string, Pending>()
const readerListeners = new Set<(label: string | null) => void>()
let lastReaderLabel: string | null = null
let installed = false

/** True only inside the shell, with the bridge actually wired up. */
export function isNativeShell(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.smPayNative && !!window.webkit?.messageHandlers?.smPay
}

/**
 * Install the single global the native side calls into. Idempotent, and safe
 * to call from an effect — it never runs during SSR.
 */
function install(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.smPayEvent = (e: NativeReaderEvent) => {
    if (e.type === 'reader') {
      lastReaderLabel = e.label
      readerListeners.forEach((fn) => fn(e.label))
      return
    }
    const p = pending.get(e.id)
    if (!p) return // a late event for a charge we already gave up on
    if (e.type === 'status') {
      p.onStatus?.(e.message)
      return
    }
    pending.delete(e.id)
    p.resolve(e.ok ? { ok: true, paymentIntentId: e.paymentIntentId } : { ok: false, error: e.error })
  }
}

/**
 * Subscribe to reader connect/disconnect. Returns an unsubscribe. Fires once
 * immediately with the label we already know, so a component mounting after
 * the reader connected still renders the right thing.
 */
export function onReaderChange(fn: (label: string | null) => void): () => void {
  install()
  readerListeners.add(fn)
  fn(lastReaderLabel)
  return () => {
    readerListeners.delete(fn)
  }
}

export function nativeReaderLabel(): string | null {
  return lastReaderLabel
}

function post(msg: Record<string, unknown>): void {
  window.webkit?.messageHandlers?.smPay?.postMessage(msg)
}

/**
 * Run one card-present collection on the M2.
 *
 * Resolves only when the payment succeeded, was declined, or errored — the
 * native side owns the whole retry-on-decline loop against this same intent,
 * because Stripe is explicit that a second PaymentIntent for a declined card
 * means a second authorisation on the customer.
 *
 * Never rejects: a bridge that throws at the till is worse than one that
 * hands back a sentence Mel can read.
 */
export function collectOnNativeReader(input: {
  clientSecret: string
  amountCents: number
  onStatus?: (message: string) => void
}): Promise<{ ok: true; paymentIntentId: string } | { ok: false; error: string }> {
  install()
  if (!isNativeShell()) {
    return Promise.resolve({ ok: false as const, error: 'The card reader app is not running.' })
  }
  const id = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return new Promise((resolve) => {
    pending.set(id, { resolve, onStatus: input.onStatus })
    post({
      id,
      action: 'collect',
      clientSecret: input.clientSecret,
      amountCents: input.amountCents,
    })
  })
}

/**
 * Ask the shell to stop waiting for a card. The pending promise still settles
 * through the normal 'result' path, so callers don't need to unwind anything
 * themselves — voiding the PaymentIntent is the caller's job via
 * cancelSdkCardPayment().
 */
export function cancelNativeCollect(): void {
  if (!isNativeShell()) return
  pending.forEach((_p, id) => post({ id, action: 'cancel' }))
}
