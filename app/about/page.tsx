import type { Metadata } from 'next'
import StoreLayout from '@/app/components/StoreLayout'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Meet Mel — the maker behind Smelly Melly. Small-batch body butter, bath salts, wax melts, and lip balm handcrafted in Cumberland, Maryland.',
}

export default function AboutPage() {
  return (
    <StoreLayout>
      <div className="bg-gradient-to-b from-brand-cream to-surface-warm py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            About Smelly Melly
          </h1>
          <p className="mt-2 text-center text-brand-brown/60">
            Handmade with love in Cumberland, Maryland
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-brand-brown leading-relaxed">
        <p>
          Hi there, I&apos;m Mel! What started as a kitchen hobby has turned
          into a full-time love affair with good scent. Every jar, every
          tube, every little package of wax melts is made by hand, in small
          batches, right here in Cumberland.
        </p>

        <p>Here&apos;s what you&apos;ll find on the shelves:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Body butter</strong> in 4 oz and 8 oz jars — scents from
            cozy (Vanilla, Cocoa Butter, Cranberry Cider) to playful
            (Birthday Cake, Fruit Loop, Monkey Farts) to grown-up
            (Mahogany Teakwood, Tobacco Vanilla, Noir).
          </li>
          <li>
            <strong>Body scrubs</strong> that leave your skin soft without
            a chemistry-class ingredient list.
          </li>
          <li>
            <strong>Bath salts</strong> for long soaks on the days you
            need one.
          </li>
          <li>
            <strong>Wax melts and room fragrance sprays</strong> so your
            house smells like something you actually want to come home to.
          </li>
          <li>
            <strong>Lip balm</strong> in a handful of flavors — Bubblegum,
            Peppermint, Spearmint.
          </li>
        </ul>

        <p>
          I stick to natural oils, butters, and skin-safe fragrance —
          nothing you can&apos;t pronounce, nothing you don&apos;t need.
          The scents are inspired by the stuff I grew up around: wildflowers
          after a rain, fresh-baked mornings, wood smoke on a back porch.
        </p>

        <div className="card bg-brand-cream/50 text-center">
          <p className="font-display text-xl font-semibold text-brand-terra">
            &ldquo;Every jar made small. Every scent made to matter.&rdquo;
          </p>
          <p className="mt-2 text-sm text-brand-brown/60">&mdash; Mel</p>
        </div>

        <p>
          Every order is packed by me. If you&apos;re picking up through a
          fundraiser host, I hand the bundle to them — if you&apos;re
          ordering online, it goes straight to the post office. Either way,
          if something isn&apos;t right when it lands, tell me and I&apos;ll
          make it right.
        </p>

        <p className="text-brand-brown/60 text-sm">
          Questions, custom scent requests, wholesale or party hosting?{' '}
          <a href="/contact" className="text-brand-terra hover:underline">
            Drop me a line
          </a>
          — I&apos;d love to hear from you.
        </p>
      </div>
    </StoreLayout>
  )
}
