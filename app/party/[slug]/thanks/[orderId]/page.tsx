import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/app/lib/prisma'

export const dynamic = 'force-dynamic'

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function PartyThanksPage({
  params,
}: {
  params: Promise<{ slug: string; orderId: string }>
}) {
  const { slug, orderId } = await params

  const order = await prisma.sM_Order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      campaign: { include: { host: { select: { name: true } } } },
    },
  })
  if (!order || !order.campaign || order.campaign.slug !== slug) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-brand-warm/20 flex items-start justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-lg border border-brand-warm/40 p-6 sm:p-8 mt-8">
        <div className="text-5xl mb-3">✨</div>
        <h1 className="font-display text-3xl font-bold text-brand-dark">
          Thank you, {order.customerName.split(' ')[0]}!
        </h1>
        <p className="mt-2 text-brand-brown/80">
          Your order <span className="font-mono">#{order.orderNumber}</span>{' '}
          for the <strong>{order.campaign.name}</strong> fundraiser has been
          placed.
        </p>

        <section className="mt-6">
          <h2 className="text-xs uppercase tracking-wider text-brand-brown/60 mb-2">
            Order
          </h2>
          <ul className="text-sm divide-y divide-brand-warm/30">
            {order.items.map((i) => (
              <li key={i.id} className="py-2 flex items-center gap-3">
                <span className="tabular-nums w-8 text-brand-brown/70">
                  ×{i.quantity}
                </span>
                <span className="flex-1">
                  <span className="text-brand-dark">{i.productName}</span>
                  <span className="text-brand-brown/60"> · {i.variantName}</span>
                </span>
                <span className="tabular-nums">{money(i.totalCents)}</span>
              </li>
            ))}
          </ul>
          <div className="pt-3 mt-2 border-t border-brand-warm/40 flex justify-between text-brand-dark font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(order.totalCents)}</span>
          </div>
        </section>

        <section className="mt-6 rounded bg-brand-warm/30 text-brand-brown text-sm p-4 space-y-2">
          <div>
            <strong>Next step:</strong> bring payment of{' '}
            <span className="font-mono">{money(order.totalCents)}</span> to{' '}
            <strong>{order.campaign.host.name}</strong> at the event.
          </div>
          <div>
            Mel will hand off your items to {order.campaign.host.name} to
            distribute.
          </div>
          <div>
            Save this page or screenshot it for your records.
          </div>
        </section>

        <div className="mt-8 flex items-center justify-between">
          <Link
            href={`/party/${slug}`}
            className="text-sm text-brand-terra hover:underline"
          >
            ← Back to fundraiser
          </Link>
          <Link href="/" className="text-sm text-brand-brown/60 hover:text-brand-terra">
            smellymellys.net
          </Link>
        </div>
      </div>
    </div>
  )
}
