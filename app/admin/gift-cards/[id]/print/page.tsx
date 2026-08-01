import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { formatGiftCode } from '@/app/lib/gift-cards'
import CertificateShell from './CertificateShell'

export const dynamic = 'force-dynamic'

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * The physical certificate. Reprintable at any time from the card's code —
 * which is exactly why codes are stored in plaintext: a customer who loses
 * theirs can have it run off again.
 */
export default async function GiftCardPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const [card, settings] = await Promise.all([
    prisma.sM_GiftCard.findUnique({ where: { id } }),
    prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: { businessName: true, businessEmail: true, businessPhone: true, logoUrl: true },
    }),
  ])
  if (!card) notFound()

  const businessName = settings?.businessName || 'Smelly Melly'
  const isBlank = card.status === 'UNISSUED'

  return (
    <CertificateShell backHref={`/admin/gift-cards/${card.id}`}>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="sm-cert rounded-2xl border-[3px] border-double border-[#c8557a] bg-[#fffaf7] p-10 text-center">
          {settings?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt={businessName}
              className="mx-auto mb-4 h-24 w-auto object-contain"
            />
          ) : (
            <div className="mb-4 font-display text-3xl font-bold text-[#6a3a4a]">
              {businessName}
            </div>
          )}

          <div className="text-xs uppercase tracking-[0.3em] text-[#a08070]">
            Gift Certificate
          </div>

          <div className="mt-6 font-display text-6xl font-bold text-[#6a3a4a] tabular-nums">
            {isBlank ? (
              <span className="text-4xl text-[#c9b5aa]">$ ______</span>
            ) : (
              money(card.initialCents)
            )}
          </div>

          {!isBlank && card.balanceCents !== card.initialCents && (
            <p className="mt-2 text-sm text-[#a08070]">
              Remaining balance as of today: {money(card.balanceCents)}
            </p>
          )}

          <div className="mx-auto my-8 max-w-sm border-t border-[#e8d5cc]" />

          <div className="grid grid-cols-2 gap-6 text-left text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a08070]">To</div>
              <div className="mt-1 min-h-[1.75rem] border-b border-[#e8d5cc] pb-1 text-[#6a3a4a]">
                {card.recipientName || ''}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-[#a08070]">From</div>
              <div className="mt-1 min-h-[1.75rem] border-b border-[#e8d5cc] pb-1 text-[#6a3a4a]">
                {card.purchaserName || ''}
              </div>
            </div>
          </div>

          {card.giftMessage && (
            <p className="mt-6 font-display text-lg italic text-[#8a6a5a]">
              “{card.giftMessage}”
            </p>
          )}

          <div className="mt-8 inline-block rounded-lg border border-[#e8d5cc] bg-white px-6 py-3">
            <div className="text-[10px] uppercase tracking-widest text-[#a08070]">
              Certificate number
            </div>
            <div className="mt-1 font-mono text-2xl font-bold tracking-[0.15em] text-[#6a3a4a]">
              {formatGiftCode(card.code)}
            </div>
          </div>

          <p className="mt-8 text-[11px] leading-relaxed text-[#a08070]">
            Redeem in person or at checkout. Never expires and carries no fees. Not redeemable
            for cash except where required by law. Treat this like cash — {businessName} can
            replace a lost certificate only from this number.
          </p>

          {(settings?.businessEmail || settings?.businessPhone) && (
            <p className="mt-3 text-[11px] text-[#a08070]">
              {[settings?.businessEmail, settings?.businessPhone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {isBlank && (
          <p className="mt-4 text-center text-xs text-brand-brown/60 print:hidden">
            This is a blank. Write the amount on it when you sell it, then activate it in the
            admin so it can actually be redeemed.
          </p>
        )}
      </div>
    </CertificateShell>
  )
}
