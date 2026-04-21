import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { PAGE_TEXT_REGISTRY, fallbackFor } from '@/app/lib/page-text'
import { CopyEditor } from './CopyEditor'

export const dynamic = 'force-dynamic'

export default async function CopyEditorPage() {
  await requireAdmin()

  const rows = await prisma.sM_PageText.findMany()
  const overrides = new Map(rows.map((r) => [r.key, r.value]))

  const fields = PAGE_TEXT_REGISTRY.map((f) => ({
    ...f,
    currentValue: overrides.get(f.key) ?? f.fallback,
    isOverridden: overrides.has(f.key),
  }))

  // Group by page
  const groups = new Map<string, typeof fields>()
  for (const f of fields) {
    const list = groups.get(f.group) ?? []
    list.push(f)
    groups.set(f.group, list)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          Edit page copy
        </h1>
        <p className="mt-2 text-brand-brown/60">
          Rewrite the words on your public pages without asking a developer.
          Changes show up on the site the moment you save. Leaving a field
          blank (or clicking <em>Reset</em>) brings back the original text.
        </p>
      </div>

      <div className="space-y-8">
        {[...groups.entries()].map(([groupName, items]) => (
          <section key={groupName}>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="font-display text-xl font-semibold text-brand-dark">
                {groupName}
              </h2>
              {groupName === 'About page' && (
                <Link
                  href="/about"
                  target="_blank"
                  rel="noopener"
                  className="text-sm text-brand-terra hover:underline"
                >
                  open live page →
                </Link>
              )}
            </div>
            <div className="space-y-3">
              {items.map((f) => (
                <CopyEditor
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  kind={f.kind}
                  hint={f.hint}
                  initialValue={f.currentValue}
                  fallback={fallbackFor(f.key)}
                  isOverridden={f.isOverridden}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
