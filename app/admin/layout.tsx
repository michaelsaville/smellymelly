import Link from 'next/link'
import { prisma } from '@/app/lib/prisma'

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/scents', label: 'Scents' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/campaigns', label: 'Campaigns' },
  { href: '/admin/order-forms', label: 'Paper Forms' },
  { href: '/admin/copy', label: 'Copy' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/materials', label: 'Materials' },
  { href: '/admin/recipes', label: 'Recipes' },
  { href: '/admin/ai', label: 'AI' },
  { href: '/admin/settings', label: 'Settings' },
] as const

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let logoUrl: string | null = null
  try {
    const settings = await prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
      select: { logoUrl: true },
    })
    logoUrl = settings?.logoUrl ?? null
  } catch {
    // Fallback to wordmark below; never block the admin from loading.
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <nav className="border-b border-brand-warm/40 bg-white px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="flex items-center gap-2 font-display text-xl font-bold text-brand-brown"
            >
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-8 w-auto object-contain"
                />
              )}
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
