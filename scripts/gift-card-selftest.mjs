/**
 * Gift certificate self-test. Exercises the ledger against a REAL database:
 * issue, redeem, overdraw, concurrent redemption, idempotent replay, void.
 *
 * Everything it creates is rolled back / cleaned up at the end, and it only
 * ever touches rows it made itself. Run with:
 *
 *   docker run --rm --network dochub_default -v /home/msaville/smellymelly:/app \
 *     -w /app -e DATABASE_URL="$DB_URL" node:20 \
 *     node scripts/gift-card-selftest.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const made = []
let failures = 0

function check(cond, label) {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}`)
  if (!cond) failures++
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function checkChar(body) {
  let sum = 0
  for (let i = 0; i < body.length; i++) sum += (ALPHABET.indexOf(body[i]) + 1) * (i + 1)
  return ALPHABET[sum % ALPHABET.length]
}
function newCode() {
  let b = ''
  for (let i = 0; i < 10; i++) b += ALPHABET[Math.floor(Math.random() * 32)]
  return b + checkChar(b)
}

async function mkCard(cents) {
  const code = newCode()
  const card = await prisma.sM_GiftCard.create({
    data: {
      code,
      last4: code.slice(-4),
      status: 'ACTIVE',
      initialCents: cents,
      balanceCents: cents,
      issuedAt: new Date(),
    },
  })
  made.push(card.id)
  await prisma.sM_GiftCardTxn.create({
    data: {
      giftCardId: card.id,
      type: 'ISSUE',
      amountCents: cents,
      balanceAfterCents: cents,
      actor: 'selftest',
    },
  })
  return card
}

/** Mirrors redeemFromCard: conditional decrement + ledger row, one transaction. */
async function redeem(cardId, amountCents, idempotencyKey) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.sM_GiftCard.updateMany({
      where: { id: cardId, status: 'ACTIVE', balanceCents: { gte: amountCents } },
      data: { balanceCents: { decrement: amountCents }, lastRedeemedAt: new Date() },
    })
    if (res.count !== 1) throw new Error('INSUFFICIENT')
    const after = await tx.sM_GiftCard.findUniqueOrThrow({
      where: { id: cardId },
      select: { balanceCents: true },
    })
    await tx.sM_GiftCardTxn.create({
      data: {
        giftCardId: cardId,
        type: 'REDEEM',
        amountCents: -amountCents,
        balanceAfterCents: after.balanceCents,
        idempotencyKey: idempotencyKey ?? null,
        actor: 'selftest',
      },
    })
    return after.balanceCents
  })
}

async function ledgerSum(cardId) {
  const rows = await prisma.sM_GiftCardTxn.findMany({
    where: { giftCardId: cardId },
    select: { amountCents: true },
  })
  return rows.reduce((s, r) => s + r.amountCents, 0)
}

async function main() {
  console.log('\n— gift certificate ledger self-test —\n')

  // 1. Issue then partial redeem
  const a = await mkCard(2500)
  const balAfter = await redeem(a.id, 1000)
  check(balAfter === 1500, `partial redeem: $25.00 − $10.00 = $15.00 (got ${balAfter / 100})`)
  check((await ledgerSum(a.id)) === 1500, 'ledger sums to the cached balance')

  // 2. Overdraw is refused and changes nothing
  let refused = false
  try {
    await redeem(a.id, 999999)
  } catch {
    refused = true
  }
  const stillFifteen = (await prisma.sM_GiftCard.findUniqueOrThrow({ where: { id: a.id } }))
    .balanceCents
  check(refused, 'overdraw is refused')
  check(stillFifteen === 1500, `overdraw left the balance alone (${stillFifteen / 100})`)
  check((await ledgerSum(a.id)) === 1500, 'overdraw wrote no ledger row')

  // 3. Concurrent redemption: $20 card, two simultaneous $15 spends.
  //    Exactly one must win, and the balance must never go negative.
  const b = await mkCard(2000)
  const results = await Promise.allSettled([redeem(b.id, 1500), redeem(b.id, 1500)])
  const won = results.filter((r) => r.status === 'fulfilled').length
  const bBal = (await prisma.sM_GiftCard.findUniqueOrThrow({ where: { id: b.id } })).balanceCents
  check(won === 1, `exactly one of two concurrent $15 spends succeeded (got ${won})`)
  check(bBal === 500, `balance is $5.00, never negative (got ${bBal / 100})`)
  check((await ledgerSum(b.id)) === bBal, 'ledger still agrees after the race')

  // 4. Replaying the same idempotency key cannot spend twice
  const c = await mkCard(3000)
  const key = `selftest:${Date.now()}:${Math.random()}`
  await redeem(c.id, 1000, key)
  let replayRejected = false
  try {
    await redeem(c.id, 1000, key)
  } catch {
    replayRejected = true
  }
  const cBal = (await prisma.sM_GiftCard.findUniqueOrThrow({ where: { id: c.id } })).balanceCents
  check(replayRejected, 'replayed idempotency key is rejected')
  check(cBal === 2000, `replay did not double-spend (balance ${cBal / 100}, expected 20)`)
  check((await ledgerSum(c.id)) === cBal, 'replay rolled back cleanly — ledger matches')

  // 5. Void zeroes the card and it can no longer be spent
  const d = await mkCard(1000)
  await prisma.$transaction(async (tx) => {
    await tx.sM_GiftCard.updateMany({
      where: { id: d.id, status: 'ACTIVE' },
      data: { status: 'VOID', balanceCents: 0 },
    })
    await tx.sM_GiftCardTxn.create({
      data: {
        giftCardId: d.id,
        type: 'VOID',
        amountCents: -1000,
        balanceAfterCents: 0,
        reason: 'selftest',
        actor: 'selftest',
      },
    })
  })
  let voidRefused = false
  try {
    await redeem(d.id, 100)
  } catch {
    voidRefused = true
  }
  check(voidRefused, 'a voided certificate cannot be redeemed')
  check((await ledgerSum(d.id)) === 0, 'voided certificate ledger sums to zero')

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`}\n`)
}

main()
  .catch((e) => {
    console.error(e)
    failures++
  })
  .finally(async () => {
    // Clean up only what this run created.
    if (made.length) {
      await prisma.sM_GiftCardTxn.deleteMany({ where: { giftCardId: { in: made } } })
      await prisma.sM_GiftCard.deleteMany({ where: { id: { in: made } } })
      console.log(`cleaned up ${made.length} test certificates`)
    }
    await prisma.$disconnect()
    process.exit(failures === 0 ? 0 : 1)
  })
