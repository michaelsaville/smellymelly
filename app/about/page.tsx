import StoreLayout from '@/app/components/StoreLayout'

export default function AboutPage() {
  return (
    <StoreLayout>
      <div className="bg-gradient-to-b from-brand-cream to-surface-warm py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            About Smelly Melly
          </h1>
          <p className="mt-2 text-center text-brand-brown/60">
            Handmade with love in the mountains of West Virginia
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-brand-brown leading-relaxed">
        <p>
          Hi there, I&apos;m Mel! What started as a hobby in my kitchen has
          grown into a labor of love. I make every single candle, soap, bath
          bomb, and body care product by hand using carefully chosen
          ingredients that are gentle on your skin and kind to the earth.
        </p>

        <p>
          Growing up in West Virginia, I was always surrounded by the scents
          of wildflowers, fresh rain, and wood smoke. Those memories inspire
          every fragrance I create. Whether it&apos;s a warm vanilla candle
          for a cozy evening or a zesty citrus soap to start your morning,
          each product is crafted in small batches to ensure the highest
          quality.
        </p>

        <p>
          I believe that self-care shouldn&apos;t come with a list of
          ingredients you can&apos;t pronounce. That&apos;s why I keep things
          simple: natural oils, butters, essential oils, and skin-safe
          fragrances. No harsh chemicals, no fillers, no compromise.
        </p>

        <div className="card bg-brand-cream/50 text-center">
          <p className="font-display text-xl font-semibold text-brand-terra">
            &ldquo;Life is too short for boring soap.&rdquo;
          </p>
          <p className="mt-2 text-sm text-brand-brown/60">&mdash; Mel</p>
        </div>

        <p>
          Every order is wrapped with care and shipped from my workshop here
          in the Mountain State. Whether you&apos;re treating yourself or
          gifting something special to someone you love, I hope my products
          bring a little joy to your day.
        </p>

        <p className="text-brand-brown/60 text-sm">
          Have questions or special requests? Don&apos;t hesitate to{' '}
          <a href="/contact" className="text-brand-terra hover:underline">
            get in touch
          </a>
          . I&apos;d love to hear from you!
        </p>
      </div>
    </StoreLayout>
  )
}
