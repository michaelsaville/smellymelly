import Link from 'next/link'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function OrderFormsPage() {
  await requireAdmin()

  const variantCount = await prisma.sM_ProductVariant.count({
    where: { isActive: true, product: { isActive: true } },
  })

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark">
        Paper Order Forms
      </h1>
      <p className="mt-2 text-brand-brown/60">
        Printable catalog + order sheets for nursing-home drop-offs, fundraisers, and
        anywhere folks would rather fill out a paper form. Catalog is on the front,
        grid order form on the back. Scan the completed back page to auto-create the order.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <a
          href="/api/admin/order-forms/pdf"
          target="_blank"
          rel="noopener"
          className="card hover:border-brand-terra hover:shadow-md transition-all group"
        >
          <div className="text-4xl mb-3">🖨️</div>
          <h2 className="font-display text-xl font-semibold text-brand-dark group-hover:text-brand-terra">
            Generate Order Form PDF
          </h2>
          <p className="mt-2 text-sm text-brand-brown/60">
            Downloads an up-to-date PDF with every active variant ({variantCount}
            {' '}total). Print double-sided on letter paper.
          </p>
          <div className="mt-4 inline-flex items-center text-sm font-medium text-brand-terra">
            Download PDF →
          </div>
        </a>

        <Link
          href="/admin/order-forms/scan"
          className="card hover:border-brand-terra hover:shadow-md transition-all group"
        >
          <div className="text-4xl mb-3">📷</div>
          <h2 className="font-display text-xl font-semibold text-brand-dark group-hover:text-brand-terra">
            Scan Completed Form
          </h2>
          <p className="mt-2 text-sm text-brand-brown/60">
            Upload a photo of a filled-out back page. Claude reads the handwriting,
            matches items to variants, and you review before the order is created.
          </p>
          <div className="mt-4 inline-flex items-center text-sm font-medium text-brand-terra">
            Scan a form →
          </div>
        </Link>
      </div>

      <div className="mt-10 card bg-brand-warm/30 border-brand-warm">
        <h3 className="font-display text-base font-semibold text-brand-brown mb-2">
          Tips for best scan results
        </h3>
        <ul className="text-sm text-brand-brown/70 space-y-1 list-disc pl-5">
          <li>Flat surface, even lighting, whole page in frame.</li>
          <li>Ask folks to write quantities as numerals inside the boxes (not tally marks).</li>
          <li>Leave a qty box blank for items they don&apos;t want.</li>
          <li>Always review the extracted order before confirming — handwriting varies.</li>
        </ul>
      </div>
    </div>
  )
}
