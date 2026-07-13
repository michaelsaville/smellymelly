import { prisma } from '@/app/lib/prisma'
import AdminNav from './AdminNav'

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
      <AdminNav logoUrl={logoUrl} />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">{children}</main>
    </div>
  )
}
