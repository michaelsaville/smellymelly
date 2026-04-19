import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import SettingsForm from './SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireAdmin()

  const settings = await prisma.sM_Settings.findFirst({
    where: { id: 'singleton' },
  })

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">
        Settings
      </h1>
      <p className="text-sm text-brand-brown/60 mb-6">
        Payment handles and tax settings. Maintenance mode lives on the dashboard.
      </p>

      <SettingsForm
        venmoHandle={settings?.venmoHandle ?? ''}
        cashAppTag={settings?.cashAppTag ?? ''}
        paymentInstructions={settings?.paymentInstructions ?? ''}
        taxRate={settings?.taxRate ?? 0.06}
      />
    </div>
  )
}
