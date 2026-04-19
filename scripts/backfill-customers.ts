/**
 * Backfill SM_Customer rows from existing orders. Idempotent.
 *
 * Runs inside the Docker network (where `db` resolves). Invoke with:
 *
 *   docker run --rm --network dochub_default \
 *     -v "$PWD:/work" -w /work \
 *     -e "DATABASE_URL=$DATABASE_URL" \
 *     node:20-alpine \
 *     sh -c "npx --yes tsx scripts/backfill-customers.ts"
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COUNTED_STATUSES = [
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'PICKED_UP',
] as const

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function main() {
  const orders = await prisma.sM_Order.findMany({
    orderBy: { createdAt: 'asc' },
  })

  if (orders.length === 0) {
    console.log('No orders to backfill.')
    return
  }

  const byEmail = new Map<string, typeof orders>()
  for (const order of orders) {
    const email = normalizeEmail(order.customerEmail)
    if (!email) continue
    if (!byEmail.has(email)) byEmail.set(email, [])
    byEmail.get(email)!.push(order)
  }

  console.log(`Grouping ${orders.length} orders into ${byEmail.size} customers.`)

  let created = 0
  let updated = 0
  let linked = 0

  for (const [email, customerOrders] of byEmail) {
    const latest = customerOrders[customerOrders.length - 1]
    const existing = await prisma.sM_Customer.findUnique({ where: { email } })

    const customer = existing
      ? (await prisma.sM_Customer.update({
          where: { email },
          data: { name: latest.customerName, phone: latest.customerPhone ?? undefined },
        }),
        existing)
      : (created++,
        await prisma.sM_Customer.create({
          data: {
            email,
            name: latest.customerName,
            phone: latest.customerPhone,
          },
        }))
    if (existing) updated++

    // Link every order for this email.
    const unlinked = customerOrders.filter((o) => o.customerId !== customer.id)
    if (unlinked.length > 0) {
      await prisma.sM_Order.updateMany({
        where: { id: { in: unlinked.map((o) => o.id) } },
        data: { customerId: customer.id },
      })
      linked += unlinked.length
    }

    // Recompute denormalized stats.
    const counted = customerOrders.filter((o) => COUNTED_STATUSES.includes(o.status as (typeof COUNTED_STATUSES)[number]))
    const orderCount = counted.length
    const totalSpentCents = counted.reduce((sum, o) => sum + o.totalCents, 0)
    const firstOrderAt = counted[0]?.createdAt ?? null
    const lastOrderAt = counted[counted.length - 1]?.createdAt ?? null
    const lastShip = [...counted].reverse().find((o) => o.fulfillment === 'SHIP' && o.shippingAddress)

    await prisma.sM_Customer.update({
      where: { id: customer.id },
      data: {
        orderCount,
        totalSpentCents,
        firstOrderAt,
        lastOrderAt,
        lastShipName: lastShip?.shippingName ?? null,
        lastShipAddress: lastShip?.shippingAddress ?? null,
        lastShipCity: lastShip?.shippingCity ?? null,
        lastShipState: lastShip?.shippingState ?? null,
        lastShipZip: lastShip?.shippingZip ?? null,
      },
    })
  }

  console.log(`Done. created=${created} refreshed=${updated} orders-linked=${linked}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
