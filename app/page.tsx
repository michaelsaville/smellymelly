import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-brand-warm/40 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-bold text-brand-brown">
            Smelly Melly
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/shop" className="text-sm font-medium text-brand-brown hover:text-brand-terra transition-colors">
              Shop
            </Link>
            <Link href="/about" className="text-sm font-medium text-brand-brown hover:text-brand-terra transition-colors">
              About
            </Link>
            <Link href="/contact" className="text-sm font-medium text-brand-brown hover:text-brand-terra transition-colors">
              Contact
            </Link>
            <Link href="/cart" className="btn-ghost relative">
              Cart
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-cream to-surface-warm py-24 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-5xl font-bold text-brand-dark leading-tight sm:text-6xl">
            Handcrafted with love,
            <br />
            <span className="text-brand-terra">scented with joy</span>
          </h1>
          <p className="mt-6 text-lg text-brand-brown/70 max-w-xl mx-auto">
            Small-batch candles, soaps, bath bombs, and body care products —
            made by hand in West Virginia.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/shop" className="btn-primary text-base px-8 py-3">
              Shop Now
            </Link>
            <Link href="/about" className="btn-secondary text-base px-8 py-3">
              Our Story
            </Link>
          </div>
        </div>
      </section>

      {/* Categories Preview */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl font-bold text-brand-dark text-center">
            What We Make
          </h2>
          <p className="mt-3 text-center text-brand-brown/60">
            Everything handmade, everything with heart
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { name: 'Candles', emoji: '🕯️' },
              { name: 'Soaps', emoji: '🧼' },
              { name: 'Bath Bombs', emoji: '🛁' },
              { name: 'Lip Balm', emoji: '💋' },
              { name: 'Beard Balm', emoji: '🧔' },
            ].map((cat) => (
              <Link
                key={cat.name}
                href={`/shop?category=${cat.name.toLowerCase().replace(/ /g, '-')}`}
                className="card text-center hover:border-brand-terra/40 hover:shadow-md transition-all group"
              >
                <div className="text-4xl mb-3">{cat.emoji}</div>
                <div className="font-display text-lg font-semibold text-brand-dark group-hover:text-brand-terra transition-colors">
                  {cat.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-warm/40 bg-brand-cream py-12 px-6">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="font-display text-xl font-bold text-brand-brown">
            Smelly Melly
          </div>
          <div className="text-sm text-brand-brown/50">
            Handmade in West Virginia
          </div>
        </div>
      </footer>
    </div>
  )
}
