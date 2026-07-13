import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import SettingsForm from './SettingsForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireAdmin()

  const [settings, categories, allergens] = await Promise.all([
    prisma.sM_Settings.findFirst({ where: { id: 'singleton' } }),
    prisma.sM_Category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, baseIngredients: true },
    }),
    prisma.sM_Allergen.findMany({
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: {
        id: true,
        label: true,
        matchTerms: true,
        severity: true,
        sortOrder: true,
        isActive: true,
      },
    }),
  ])

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">
        Settings
      </h1>
      <p className="text-sm text-brand-brown/60 mb-6">
        Business contact info, payment handles, tax, ingredient templates, and
        the product disclaimer. Maintenance mode lives on the dashboard.
      </p>

      <SettingsForm
        logoUrl={settings?.logoUrl ?? null}
        businessEmail={settings?.businessEmail ?? ''}
        businessPhone={settings?.businessPhone ?? ''}
        venmoHandle={settings?.venmoHandle ?? ''}
        cashAppTag={settings?.cashAppTag ?? ''}
        paymentInstructions={settings?.paymentInstructions ?? ''}
        taxRate={settings?.taxRate ?? 0.06}
        productDisclaimer={settings?.productDisclaimer ?? ''}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          baseIngredients: c.baseIngredients ?? '',
        }))}
        allergens={allergens.map((a) => ({
          id: a.id,
          label: a.label,
          matchTerms: a.matchTerms,
          severity: a.severity === 'high' ? 'high' : 'normal',
          sortOrder: a.sortOrder,
          isActive: a.isActive,
        }))}
      />
    </div>
  )
}
