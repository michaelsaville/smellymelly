import Stripe from 'stripe'

let client: Stripe | null = null

/**
 * Server-side Stripe client. Uses the SDK's pinned API version (no override,
 * so upgrading the `stripe` package moves the version deliberately).
 * Throws if called without STRIPE_SECRET_KEY — callers must gate on
 * isStripeConfigured() first (see the checkout routes).
 */
export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return client
}

export function getStripePublishableKey(): string {
  return process.env.STRIPE_PUBLISHABLE_KEY || ''
}

/** Optional — only needed once webhook reconciliation is added. */
export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || ''
}

export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PUBLISHABLE_KEY
  )
}
