import type { Metadata } from 'next'
import StoreLayout from '@/app/components/StoreLayout'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your use of the Smelly Melly website and purchases.',
}

export default function TermsPage() {
  return (
    <StoreLayout>
      <div className="bg-gradient-to-b from-brand-cream to-surface-warm py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            Terms of Service
          </h1>
          <p className="mt-2 text-center text-brand-brown/60">
            Last updated: April 2026
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-brand-brown leading-relaxed">
        <p>
          Welcome to Smelly Melly. By using this website or placing an order
          with us, you agree to the terms below. If something here is unclear,
          reach out through our contact page and we&apos;ll happily explain.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Who we are
        </h2>
        <p>
          Smelly Melly is a small, handmade bath &amp; body business based in
          West Virginia. Every product is crafted in small batches by Mel.
          Because of that, items may vary slightly in appearance, color, and
          scent from batch to batch — it&apos;s part of the handmade charm.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Placing an order
        </h2>
        <p>
          All orders are processed through our website using a Square payment
          form. Your card is charged at the time of checkout. You&apos;ll
          receive an order confirmation by email as soon as payment is
          approved.
        </p>
        <p>
          We reserve the right to cancel any order if the item is no longer
          available, if there is an error in pricing, or if we suspect fraud.
          If we cancel your order, you&apos;ll be refunded in full.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Product safety
        </h2>
        <p>
          Our products are made with natural oils, butters, and skin-safe
          fragrance. We list ingredients on each product page so you can check
          for anything you&apos;re sensitive to. Patch-test any new product on
          a small area of skin before full use. If irritation occurs, stop
          using the product and consult a medical professional.
        </p>
        <p>
          Candles, wax melts, and similar items must be used as directed.
          Never leave a burning candle unattended.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Intellectual property
        </h2>
        <p>
          All text, photography, and product names on this site are the
          property of Smelly Melly. Please don&apos;t copy or redistribute
          them without permission.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Limitation of liability
        </h2>
        <p>
          To the fullest extent permitted by law, Smelly Melly is not liable
          for any indirect, incidental, or consequential damages arising from
          the use of our products or this website. Our total liability for any
          order is limited to the amount you paid for that order.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Changes to these terms
        </h2>
        <p>
          We may update these terms from time to time. The revised version
          will be posted on this page with a new &ldquo;last updated&rdquo;
          date. Continued use of the site after that date means you accept
          the new terms.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Contact
        </h2>
        <p>
          Questions about these terms? Reach out through our{' '}
          <a href="/contact" className="text-brand-terra hover:underline">
            contact page
          </a>
          .
        </p>
      </div>
    </StoreLayout>
  )
}
