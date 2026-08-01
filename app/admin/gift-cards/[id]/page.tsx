import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { formatGiftCode } from '@/app/lib/gift-cards'
import GiftCardActions from './GiftCardActions'

export const dynamic = 'force-dynamic'

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

/** Signed cents, shown with an explicit sign so a ledger reads unambiguously. */
function signed(cents: number) {
  const s = `$${(Math.abs(cents) / 100).toFixed(2)}`
  return cents < 0 ? `−${s}` : `+${s}`
}

const TXN_LABEL: Record<string, string> = {
  ISSUE: 'Issued',
  RELOAD: 'Reloaded',
  REDEEM: 'Redeemed',
  REFUND_TO_CARD: 'Refunded back',
  ADJUST: 'Adjusted',
  VOID: 'Voided',
}

const STATUS_STYLE: Record<string, string> = {
  UNISSUED: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
  VOID: 'bg-red-100 text-red-700',
}

export default async function GiftCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const card = await prisma.sM_GiftCard.findUnique({
    where: { id },
    include: { transactions: { orderBy: { createdAt: 'desc' } } },
  })
  if (!card) notFound()

  // The ledger is authoritative; balanceCents is only a cache. If they ever
  // disagree, something wrote a balance without a ledger row and Mel needs to
  // know rather than trust the number on screen.
  const ledgerBalance = card.transactions.reduce((s, t) => s + t.amountCents, 0)
  const drift = card.status === 'VOID' ? 0 : ledgerBalance - card.balanceCents

  // SM_GiftCardTxn.orderId is a bare string with no relation, so resolve the
  // human order numbers here. Without this the history reads "Order bnftoq"
  // (a CUID tail), which Mel cannot search for in the Orders list.
  const orderIds = [...new Set(card.transactions.map((t) => t.orderId).filter(Boolean))] as string[]
  const orderNumbers = new Map(
    orderIds.length
      ? (
          await prisma.sM_Order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, orderNumber: true },
          })
        ).map((o) => [o.id, o.orderNumber])
      : [],
  )

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/gift-cards" className="text-sm text-brand-brown/60 hover:text-brand-terra">
        ← All certificates
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-wide text-brand-dark">
            {formatGiftCode(card.code)}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLE[card.status] ?? ''
              }`}
            >
              {card.status}
            </span>
            <span className="text-xs text-brand-brown/60">
              {card.issueReason.charAt(0) + card.issueReason.slice(1).toLowerCase()}
            </span>
          </div>
        </div>
        <Link href={`/admin/gift-cards/${card.id}/print`} className="btn-secondary text-sm">
          Print certificate
        </Link>
      </div>

      {drift !== 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Balance doesn&apos;t match the ledger.</strong> The history adds up to{' '}
          {money(ledgerBalance)} but the stored balance is {money(card.balanceCents)}. The history
          is the truth — don&apos;t honour the balance above until this is sorted out.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-brand-brown/60">Balance</div>
          <div className="mt-1 font-display text-3xl font-bold text-brand-dark tabular-nums">
            {money(card.balanceCents)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-brand-brown/60">Face value</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-brown/80 tabular-nums">
            {card.status === 'UNISSUED' ? '—' : money(card.initialCents)}
          </div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-brand-brown/60">Issued</div>
          <div className="mt-1 text-sm text-brand-dark">
            {card.issuedAt ? card.issuedAt.toLocaleDateString() : 'Not yet'}
          </div>
          {card.lastRedeemedAt && (
            <p className="mt-1 text-xs text-brand-brown/50">
              Last used {card.lastRedeemedAt.toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {(card.recipientName || card.purchaserName || card.giftMessage) && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {card.recipientName && (
              <div>
                <div className="text-xs uppercase tracking-wider text-brand-brown/60">For</div>
                <div className="text-sm text-brand-dark">{card.recipientName}</div>
              </div>
            )}
            {card.purchaserName && (
              <div>
                <div className="text-xs uppercase tracking-wider text-brand-brown/60">From</div>
                <div className="text-sm text-brand-dark">{card.purchaserName}</div>
              </div>
            )}
          </div>
          {card.giftMessage && (
            <p className="mt-3 border-t border-brand-warm/40 pt-3 text-sm italic text-brand-brown/80">
              “{card.giftMessage}”
            </p>
          )}
        </div>
      )}

      <GiftCardActions
        cardId={card.id}
        status={card.status}
        balanceCents={card.balanceCents}
        notes={card.notes ?? ''}
      />

      {/* Ledger */}
      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-brand-dark">History</h2>
        {card.transactions.length === 0 ? (
          <div className="card py-8 text-center text-sm text-brand-brown/60">
            Nothing yet — this blank hasn&apos;t been activated.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-warm/60">
            <table className="w-full text-sm">
              <thead className="bg-brand-cream text-left text-xs font-medium uppercase tracking-wider text-brand-brown/60">
                <tr>
                  <th className="px-4 py-3">What</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance after</th>
                  <th className="px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-warm/40 bg-white">
                {card.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium text-brand-dark">
                      {TXN_LABEL[t.type] ?? t.type}
                      <span className="ml-2 text-xs font-normal text-brand-brown/50">
                        {t.actor}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${
                        t.amountCents < 0 ? 'text-red-600' : 'text-green-700'
                      }`}
                    >
                      {signed(t.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-brand-brown/70">
                      {money(t.balanceAfterCents)}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-brown/60">
                      {t.reason ||
                        (t.orderId ? (
                          <Link
                            href={`/admin/orders/${t.orderId}`}
                            className="hover:text-brand-terra hover:underline"
                          >
                            {orderNumbers.has(t.orderId)
                              ? `Order #${orderNumbers.get(t.orderId)}`
                              : 'View order'}
                          </Link>
                        ) : (
                          '—'
                        ))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-brand-brown/50">
                      {t.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-brand-brown/50">
          History is append-only — corrections are added as new lines, never edits.
        </p>
      </div>
    </div>
  )
}
