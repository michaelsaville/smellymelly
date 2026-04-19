'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

function CartBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    function updateCount() {
      try {
        const raw = localStorage.getItem('sm_cart')
        if (raw) {
          const items = JSON.parse(raw) as { quantity: number }[]
          setCount(items.reduce((sum, i) => sum + i.quantity, 0))
        } else {
          setCount(0)
        }
      } catch {
        setCount(0)
      }
    }

    updateCount()
    window.addEventListener('sm:cart-updated', updateCount)
    return () => window.removeEventListener('sm:cart-updated', updateCount)
  }, [])

  if (count === 0) return null

  return (
    <span className="absolute -top-1 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-terra text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

const navLinks = [
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-brand-warm/40 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-bold text-brand-brown">
            Smelly Melly
          </Link>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 text-brand-brown"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname?.startsWith(link.href)
                    ? 'text-brand-terra'
                    : 'text-brand-brown hover:text-brand-terra'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/cart" className="btn-ghost relative">
              Cart
              <CartBadge />
            </Link>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-brand-warm/40 bg-white px-6 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block text-sm font-medium transition-colors ${
                  pathname?.startsWith(link.href)
                    ? 'text-brand-terra'
                    : 'text-brand-brown hover:text-brand-terra'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/cart"
              onClick={() => setMobileOpen(false)}
              className="block text-sm font-medium text-brand-brown hover:text-brand-terra relative w-fit"
            >
              Cart
              <CartBadge />
            </Link>
          </div>
        )}
      </nav>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-brand-warm/40 bg-brand-cream py-12 px-6">
        <div className="mx-auto max-w-6xl grid gap-6 sm:grid-cols-3 sm:items-start">
          <div>
            <div className="font-display text-xl font-bold text-brand-brown">
              Smelly Melly
            </div>
            <div className="mt-1 text-sm text-brand-brown/50">
              Handmade in West Virginia
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-center">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-brown/40">
              Shop
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-brand-brown/70 hover:text-brand-terra transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-brown/40">
              Policies
            </div>
            <Link
              href="/terms"
              className="text-sm text-brand-brown/70 hover:text-brand-terra transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-brand-brown/70 hover:text-brand-terra transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/refund-policy"
              className="text-sm text-brand-brown/70 hover:text-brand-terra transition-colors"
            >
              Refund &amp; Returns
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl mt-8 pt-6 border-t border-brand-warm/30 text-center text-xs text-brand-brown/40">
          &copy; {new Date().getFullYear()} Smelly Melly. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
