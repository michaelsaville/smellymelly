'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/production', label: 'Production' },
  { href: '/admin/materials', label: 'Materials' },
  { href: '/admin/recipes', label: 'Recipes' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/inquiries', label: 'Requests' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/scents', label: 'Scents' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/order-forms', label: 'Paper Forms' },
  { href: '/admin/copy', label: 'Copy' },
  { href: '/admin/ai', label: 'AI' },
  { href: '/admin/settings', label: 'Settings' },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AdminNav({ logoUrl }: { logoUrl: string | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <nav className="border-b border-brand-warm/40 bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-3">
          <Link href="/admin" className="flex items-center gap-2 font-display text-xl font-bold text-brand-brown">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logoUrl && <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />}
            SM Admin
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden sm:inline text-xs text-brand-brown/50 hover:text-brand-terra">View Store →</Link>
            {/* Hamburger — mobile only */}
            <button
              type="button"
              aria-label="Menu"
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-brown hover:bg-brand-warm"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop links — wrap so 20 items never overflow */}
        <div className="hidden lg:flex flex-wrap items-center gap-1 pb-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive(pathname, item.href)
                  ? 'bg-brand-terra text-white'
                  : 'text-brand-brown/70 hover:bg-brand-warm hover:text-brand-dark'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden border-t border-brand-warm/40 bg-white px-4 pb-3">
          <div className="grid grid-cols-2 gap-1 pt-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 min-h-[44px] flex items-center text-sm font-medium ${
                  isActive(pathname, item.href)
                    ? 'bg-brand-terra text-white'
                    : 'text-brand-brown/80 hover:bg-brand-warm'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <Link href="/" onClick={() => setOpen(false)} className="mt-2 block text-center text-xs text-brand-brown/50">View Store →</Link>
        </div>
      )}
    </nav>
  )
}
