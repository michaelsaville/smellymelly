import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { formatGiftCode } from '@/app/lib/gift-cards'
import CertificateShell from '../../../[id]/print/CertificateShell'

export const dynamic = 'force-dynamic'

/**
 * A whole batch of pre-printed blanks, two to a letter sheet. Each certificate
 * has a tear-off stub with the same number: Mel fills both in at the market,
 * hands over the certificate, and keeps the stub so she can enter the sale
 * afterwards on /admin/gift-cards/batch/[batchId].
 *
 * Only still-UNISSUED cards print — reprinting a batch after some have sold
 * must never produce a second copy of a live certificate.
 */
export default async function BatchPrintPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  await requireAdmin()
  const { batchId } = await params

  const [cards, settings] = await Promise.all([
    prisma.sM_GiftCard.findMany({
      where: { batchId, status: 'UNISSUED' },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: { businessName: true, businessEmail: true, businessPhone: true, logoUrl: true },
    }),
  ])
  const total = await prisma.sM_GiftCard.count({ where: { batchId } })
  if (total === 0) notFound()

  const businessName = settings?.businessName || 'Smelly Melly'
  const contact = [settings?.businessEmail, settings?.businessPhone].filter(Boolean).join(' · ')

  if (cards.length === 0) {
    return (
      <CertificateShell backHref={`/admin/gift-cards/batch/${batchId}`}>
        <p className="py-20 text-center text-brand-brown/70">
          Every certificate in this batch has been sold or voided — nothing left to print.
        </p>
      </CertificateShell>
    )
  }

  const line = 'mt-1 h-6 border-b border-[#d9c3b8]'
  const label = 'text-[9px] uppercase tracking-widest text-[#a08070]'

  return (
    <CertificateShell backHref={`/admin/gift-cards/batch/${batchId}`}>
      <div className="mx-auto max-w-[7.5in] px-4 py-8 print:p-0">
        <p className="mb-4 text-center text-xs text-brand-brown/60 print:hidden">
          {cards.length} blank{cards.length === 1 ? '' : 's'}, two per sheet. Fill in the
          certificate <em>and</em> its stub when you sell one; keep the stub and enter it later.
        </p>
        {cards.map((card, i) => {
          const code = formatGiftCode(card.code)
          return (
            <div
              key={card.id}
              className={`sm-cert flex h-[4.85in] overflow-hidden ${
                i % 2 === 1 ? 'break-after-page' : 'mb-[0.3in]'
              }`}
            >
              {/* The certificate the customer takes home */}
              <div className="flex flex-1 flex-col justify-between rounded-l-xl border-[3px] border-r-0 border-double border-[#c8557a] bg-[#fffaf7] px-7 py-5 text-center">
                <div>
                  {settings?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={settings.logoUrl}
                      alt={businessName}
                      className="mx-auto mb-1 h-14 w-auto object-contain"
                    />
                  ) : (
                    <div className="font-display text-2xl font-bold text-[#6a3a4a]">
                      {businessName}
                    </div>
                  )}
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[#a08070]">
                    Gift Certificate
                  </div>
                </div>

                <div className="mx-auto flex items-end gap-2 font-display text-[#6a3a4a]">
                  <span className="text-4xl font-bold">$</span>
                  <span className="mb-1 inline-block w-40 border-b-2 border-[#d9c3b8]" />
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-left">
                  <div>
                    <div className={label}>To</div>
                    <div className={line} />
                  </div>
                  <div>
                    <div className={label}>From</div>
                    <div className={line} />
                  </div>
                  <div>
                    <div className={label}>Date</div>
                    <div className={line} />
                  </div>
                  <div>
                    <div className={label}>Authorized by</div>
                    <div className={line} />
                  </div>
                </div>

                <div>
                  <div className="inline-block rounded-md border border-[#e8d5cc] bg-white px-4 py-1.5">
                    <div className={label}>Certificate number</div>
                    <div className="font-mono text-lg font-bold tracking-[0.12em] text-[#6a3a4a]">
                      {code}
                    </div>
                  </div>
                  <p className="mt-2 text-[9px] leading-snug text-[#a08070]">
                    Redeem in person or at checkout. Never expires, no fees. Not redeemable for
                    cash except where required by law. Valid once activated by {businessName}.
                    {contact && <> {contact}</>}
                  </p>
                </div>
              </div>

              {/* Tear-off stub Mel keeps */}
              <div
                className="flex w-[1.9in] flex-col justify-between rounded-r-xl border-2 border-[#d9c3b8] bg-white px-3 py-5 text-left"
                style={{ borderLeft: '2px dashed #c9b5aa' }}
              >
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-[#a08070]">
                    ✂ Keep this stub
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] font-bold leading-tight text-[#6a3a4a]">
                    {code}
                  </div>
                </div>
                <div>
                  <div className={label}>Amount</div>
                  <div className={line}>
                    <span className="text-sm text-[#a08070]">$</span>
                  </div>
                </div>
                <div>
                  <div className={label}>Paid with</div>
                  <div className="mt-1 space-y-0.5 text-[10px] text-[#6a3a4a]">
                    {['Cash', 'Card', 'Venmo', 'Cash App', 'Check'].map((m) => (
                      <div key={m}>☐ {m}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={label}>Date</div>
                  <div className={line} />
                </div>
                <div>
                  <div className={label}>To / From</div>
                  <div className={line} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </CertificateShell>
  )
}
