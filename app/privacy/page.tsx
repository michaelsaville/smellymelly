import type { Metadata } from 'next'
import StoreLayout from '@/app/components/StoreLayout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Smelly Melly collects, uses, and protects the personal information you share with us.',
}

export default function PrivacyPage() {
  return (
    <StoreLayout>
      <div className="bg-gradient-to-b from-brand-cream to-surface-warm py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            Privacy Policy
          </h1>
          <p className="mt-2 text-center text-brand-brown/60">
            Last updated: April 2026
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-brand-brown leading-relaxed">
        <p>
          Your privacy matters. This page explains what we collect, why, and
          how we keep it safe. The short version: we collect only what&apos;s
          needed to fulfill your order and contact you about it, and we
          don&apos;t sell your information.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          What we collect
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Contact info</strong> you provide at checkout or through
            the contact form: name, email, phone (optional).
          </li>
          <li>
            <strong>Shipping address</strong> if your order is being shipped.
          </li>
          <li>
            <strong>Order details</strong> — items, quantities, totals.
          </li>
          <li>
            <strong>Payment info</strong> is handled directly by Square. We
            never see or store your full card number.
          </li>
          <li>
            <strong>Basic server logs</strong> — standard request metadata
            (IP, user agent, timestamps) used to keep the site running.
          </li>
        </ul>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          How we use it
        </h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To process and ship your order.</li>
          <li>
            To send order confirmations, shipping notifications, and respond
            to messages you send us.
          </li>
          <li>
            For internal record-keeping and to comply with tax and business
            obligations.
          </li>
        </ul>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Who we share it with
        </h2>
        <p>We share the minimum needed with trusted service providers:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Square</strong> — handles payment processing.
          </li>
          <li>
            <strong>EasyPost and USPS</strong> — handle shipping rate
            calculation and label generation for shipped orders.
          </li>
          <li>
            <strong>Google (Gmail SMTP)</strong> — delivers transactional
            email.
          </li>
        </ul>
        <p>
          We do not sell or rent your personal information to anyone.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Cookies
        </h2>
        <p>
          We use a single small cookie in the admin area to keep admins logged
          in. The public storefront uses your browser&apos;s local storage to
          remember your cart — it never leaves your device.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Your rights
        </h2>
        <p>
          You can ask us at any time to tell you what information we have
          about you, correct something that&apos;s wrong, or delete your
          records (subject to any legal retention requirements). Just reach
          out through the{' '}
          <a href="/contact" className="text-brand-terra hover:underline">
            contact page
          </a>
          .
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Children
        </h2>
        <p>
          Our products are intended for adults. We do not knowingly collect
          information from children under 13.
        </p>

        <h2 className="font-display text-2xl font-semibold text-brand-dark pt-4">
          Changes
        </h2>
        <p>
          If we update this policy, we&apos;ll post the new version on this
          page with an updated date.
        </p>
      </div>
    </StoreLayout>
  )
}
