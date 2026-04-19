import type { Metadata } from 'next'
import StoreLayout from '@/app/components/StoreLayout'

export const metadata: Metadata = {
  title: 'Refund &amp; Return Policy',
  description:
    'How returns, refunds, and damaged shipments are handled for Smelly Melly orders.',
}

export default function RefundPolicyPage() {
  return (
    <StoreLayout>
      <div className="bg-gradient-to-b from-brand-cream to-surface-warm py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            Refund &amp; Return Policy
          </h1>
          <p className="mt-2 text-center text-brand-brown/60">
            Last updated: April 2026
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-brand-brown leading-relaxed">
        <p>
          We want you to love what you receive. Because our products are
          handmade in small batches and come in direct contact with skin, we
          treat returns a little differently than a big retailer would. Here&apos;s
          how it works.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Damaged or wrong item
        </h2>
        <p>
          If your order arrives damaged, or you received the wrong item,{' '}
          <strong>contact us within 7 days of delivery</strong> with a photo
          of the item. We&apos;ll replace it or refund it — whichever you
          prefer — at no cost to you.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Change of mind
        </h2>
        <p>
          Because bath &amp; body products are personal-care items, we
          cannot accept returns of opened or used products. Unopened items
          in their original packaging may be returned within 14 days of
          delivery for a refund of the item price (shipping is not
          refundable). The buyer is responsible for return shipping.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Allergic reactions
        </h2>
        <p>
          We do our best to list ingredients on every product page so you can
          avoid anything you&apos;re sensitive to. If you experience a
          reaction, please discontinue use and reach out. We&apos;ll work
          with you on a fair resolution.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Cancellations
        </h2>
        <p>
          Orders can be cancelled for a full refund any time before they
          ship. Once an order has shipped it can no longer be cancelled, but
          you&apos;re welcome to return it under the rules above.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          How refunds are issued
        </h2>
        <p>
          Refunds are processed back to the original payment method through
          Square. Please allow 3–10 business days for the refund to appear on
          your statement.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          How to start a return or refund
        </h2>
        <p>
          Reach out through our{' '}
          <a href="/contact" className="text-brand-terra hover:underline">
            contact page
          </a>{' '}
          with your order number and a quick note about what&apos;s going on.
          We&apos;ll take it from there.
        </p>
      </div>
    </StoreLayout>
  )
}
