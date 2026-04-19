import { redirect } from 'next/navigation'
import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import { isEasyPostConfigured } from '@/app/lib/easypost'
import OrderActions from './OrderActions'

export const dynamic = 'force-dynamic'

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  PAID: 'bg-green-100 text-green-700',
  PROCESSING: 'bg-green-100 text-green-700',
  SHIPPED: 'bg-blue-100 text-blue-700',
  READY_FOR_PICKUP: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-red-100 text-red-700',
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params

  const order = await prisma.sM_Order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                include: {
                  images: { orderBy: { sortOrder: 'asc' }, take: 1 },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!order) redirect('/admin/orders')

  const orderNum = String(order.orderNumber).padStart(4, '0')
  const isShip = order.fulfillment === 'SHIP'
  const canBuyLabel =
    isShip &&
    !order.trackingNumber &&
    isEasyPostConfigured() &&
    (order.status === 'PAID' || order.status === 'PROCESSING')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <a
            href="/admin/orders"
            className="text-xs text-brand-brown/60 hover:text-brand-terra"
          >
            &larr; Back to Orders
          </a>
          <h1 className="font-display text-3xl font-bold text-brand-dark mt-1">
            Order #{orderNum}
          </h1>
          <p className="text-sm text-brand-brown/60 mt-0.5">
            Placed {order.createdAt.toLocaleString()}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — items + totals */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-4">
              Items
            </h2>
            <div className="divide-y divide-brand-warm/40">
              {order.items.map((item) => {
                const image = item.variant.product.images[0]
                return (
                  <div key={item.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-surface-muted overflow-hidden">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image.url}
                          alt={image.altText ?? item.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-brand-dark">
                        {item.productName}
                      </div>
                      <div className="text-xs text-brand-brown/60">
                        {item.variantName}
                        {item.variant.sku ? ` · SKU ${item.variant.sku}` : ''}
                      </div>
                    </div>
                    <div className="text-sm text-brand-brown/70 tabular-nums">
                      {item.quantity} × {money(item.unitCents)}
                    </div>
                    <div className="font-medium text-brand-dark tabular-nums w-20 text-right">
                      {money(item.totalCents)}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 border-t border-brand-warm/40 pt-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-brand-brown/70">Subtotal</span>
                <span className="tabular-nums">{money(order.subtotalCents)}</span>
              </div>
              {order.shippingCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-brand-brown/70">Shipping</span>
                  <span className="tabular-nums">{money(order.shippingCents)}</span>
                </div>
              )}
              {order.taxCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-brand-brown/70">Tax</span>
                  <span className="tabular-nums">{money(order.taxCents)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-2 border-t border-brand-warm/40 font-semibold text-brand-dark">
                <span>Total</span>
                <span className="tabular-nums">{money(order.totalCents)}</span>
              </div>
            </div>
          </div>

          <OrderActions
            orderId={order.id}
            status={order.status}
            fulfillment={order.fulfillment}
            trackingNumber={order.trackingNumber}
            shippingLabel={order.shippingLabel}
            canBuyLabel={canBuyLabel}
            paymentMethod={order.paymentMethod}
            paidAt={order.paidAt?.toISOString() ?? null}
          />
        </div>

        {/* Right — customer + shipping + payment */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
              Customer
            </h2>
            <div className="text-sm space-y-1">
              <div className="font-medium text-brand-dark">{order.customerName}</div>
              <div>
                <a
                  href={`mailto:${order.customerEmail}`}
                  className="text-brand-terra hover:underline"
                >
                  {order.customerEmail}
                </a>
              </div>
              {order.customerPhone && (
                <div className="text-brand-brown/70">{order.customerPhone}</div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
              Fulfillment
            </h2>
            <div className="text-sm">
              <div className="mb-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isShip ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {isShip ? 'Ship' : 'Local Pickup'}
                </span>
              </div>
              {isShip ? (
                <div className="text-brand-brown/80 leading-relaxed">
                  {order.shippingName}
                  <br />
                  {order.shippingAddress}
                  <br />
                  {order.shippingCity}, {order.shippingState} {order.shippingZip}
                </div>
              ) : (
                <p className="text-brand-brown/70">
                  Customer will pick up this order.
                </p>
              )}

              {order.trackingNumber && (
                <div className="mt-4 pt-3 border-t border-brand-warm/40 space-y-1">
                  <div className="text-xs text-brand-brown/60">Tracking</div>
                  <div className="font-mono text-xs break-all">
                    {order.trackingNumber}
                  </div>
                  {order.shippingLabel && (
                    <a
                      href={order.shippingLabel}
                      target="_blank"
                      rel="noopener"
                      className="inline-block mt-1 text-xs text-brand-terra hover:underline"
                    >
                      View / print label →
                    </a>
                  )}
                  {order.shippedAt && (
                    <div className="text-xs text-brand-brown/50 mt-1">
                      Shipped {order.shippedAt.toLocaleDateString()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="font-display text-lg font-semibold text-brand-dark mb-3">
              Payment
            </h2>
            <div className="text-sm space-y-1">
              <div className="text-xs text-brand-brown/60">Method</div>
              <div className="font-medium text-brand-dark">
                {order.paymentMethod === 'SQUARE_CARD' && 'Credit / debit card (Square)'}
                {order.paymentMethod === 'SQUARE_CASH_APP' && 'Cash App Pay (Square)'}
                {order.paymentMethod === 'MANUAL' && 'Direct — Venmo / Cash App'}
              </div>
              {order.squarePaymentId && (
                <div className="mt-3 pt-3 border-t border-brand-warm/40">
                  <div className="text-xs text-brand-brown/60">Square payment ID</div>
                  <div className="font-mono text-xs text-brand-brown/60 break-all">
                    {order.squarePaymentId}
                  </div>
                </div>
              )}
              {order.paidAt && (
                <div className="text-xs text-brand-brown/50 mt-2">
                  Paid {order.paidAt.toLocaleString()}
                </div>
              )}
              {order.paymentMethod === 'MANUAL' && order.manualPaymentNote && (
                <div className="mt-3 pt-3 border-t border-brand-warm/40">
                  <div className="text-xs text-brand-brown/60">Note</div>
                  <div className="text-brand-brown/80">{order.manualPaymentNote}</div>
                </div>
              )}
              {order.paymentMethod === 'MANUAL' && !order.paidAt && (
                <p className="mt-3 pt-3 border-t border-brand-warm/40 text-xs text-amber-700">
                  Waiting on manual payment. Use the &quot;Mark as paid&quot; action in the Actions panel once money has landed.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
