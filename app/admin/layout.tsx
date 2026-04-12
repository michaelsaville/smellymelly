import Link from 'next/link'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/inventory', label: 'Inventory' },
] as const

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-muted">
      <nav className="border-b border-brand-warm/40 bg-white px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-display text-xl font-bold text-brand-brown"
            >
              SM Admin
            </Link>
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-brand-brown/70 hover:bg-brand-warm hover:text-brand-dark transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <Link
            href="/"
            className="text-xs text-brand-brown/50 hover:text-brand-terra"
          >
            View Store →
          </Link>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
