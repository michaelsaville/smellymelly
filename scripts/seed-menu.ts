/**
 * Seed SM_MenuGroup + SM_MenuGroupScent from the v4 scent menu HTML.
 *
 * Idempotent — re-running will only fill gaps. Existing groups/scents/links
 * are left alone (so Mel's manual edits in /admin/menu survive a re-seed).
 *
 * Run with:
 *   docker run --rm --network dochub_default \
 *     -v "$PWD:/work" -w /work \
 *     -e "DATABASE_URL=$(docker exec smellymelly-app printenv DATABASE_URL)" \
 *     node:20-alpine \
 *     sh -c "npx --yes tsx scripts/seed-menu.ts"
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type GroupSeed = {
  name: string
  displayLabel: string
  priceLabel: string
  theme: string
  sortOrder: number
  scents: string[]
}

const GROUPS: GroupSeed[] = [
  {
    name: 'Body',
    displayLabel: 'Body Scrubs · Whipped Body Scrubs · Body Butter',
    priceLabel: '4 oz · $10–$12',
    theme: 'scrub',
    sortOrder: 0,
    scents: [
      'Peppermint',
      'Peppermint Mocha',
      'Peppermint Mocha Coffee',
      'Eucalyptus & Spearmint',
      'Spearmint',
      'Blueberry',
      'Watermelon',
      'Cucumber Melon',
      'Lemon',
      'Lemon Honey',
      'Strawberry & Oatmeal Milk',
      'Fruit Loops',
      'Lavender',
      'Dreamsicle',
      'Vanilla',
      'Vanilla & Honey',
      'Coconut',
      'Cocoa Butter',
      'Blue Cotton Candy',
      'Honey & Brown Sugar',
      'Oatmeal Milk & Honey',
    ],
  },
  {
    name: 'Beard Balm',
    displayLabel: 'Beard Balm',
    priceLabel: '2 oz · $15',
    theme: 'beard',
    sortOrder: 1,
    scents: ['Mahogany & Teakwood', 'Vanilla Tobacco', 'Mid-Night Flannel'],
  },
  {
    name: 'Lip Balm',
    displayLabel: 'Lip Balm',
    priceLabel: '.5 oz · $6',
    theme: 'lip',
    sortOrder: 2,
    scents: ['Vanilla', 'Peppermint', 'Spearmint', 'Fruit Loop', 'Orange'],
  },
  {
    name: 'Lip Scrub',
    displayLabel: 'Lip Scrub',
    priceLabel: '.05 oz · $6',
    theme: 'scrub2',
    sortOrder: 3,
    scents: ['Vanilla', 'Peppermint', 'Spearmint', 'Fruit Loop', 'Orange'],
  },
]

async function ensureScent(name: string) {
  return prisma.sM_Scent.upsert({
    where: { name },
    update: {},
    create: { name, isActive: true },
  })
}

async function main() {
  let groupsCreated = 0
  let scentsCreated = 0
  let linksCreated = 0

  // 1. Make sure every scent listed on the menu exists in the master list.
  const allScentNames = Array.from(
    new Set(GROUPS.flatMap((g) => g.scents)),
  )
  const scentByName = new Map<string, { id: string }>()
  for (const name of allScentNames) {
    const before = await prisma.sM_Scent.findUnique({ where: { name } })
    const scent = await ensureScent(name)
    scentByName.set(name, scent)
    if (!before) scentsCreated += 1
  }

  // 2. Create each menu group + its links. Skip groups that already exist
  //    (matched by name) so Mel's edits aren't clobbered.
  for (const seed of GROUPS) {
    const existing = await prisma.sM_MenuGroup.findFirst({
      where: { name: seed.name },
    })
    if (existing) {
      console.log(`group "${seed.name}" already exists — skipping`)
      continue
    }
    const group = await prisma.sM_MenuGroup.create({
      data: {
        name: seed.name,
        displayLabel: seed.displayLabel,
        priceLabel: seed.priceLabel,
        theme: seed.theme,
        sortOrder: seed.sortOrder,
        isActive: true,
      },
    })
    groupsCreated += 1

    for (let i = 0; i < seed.scents.length; i++) {
      const scent = scentByName.get(seed.scents[i])
      if (!scent) continue
      await prisma.sM_MenuGroupScent.create({
        data: { groupId: group.id, scentId: scent.id, sortOrder: i },
      })
      linksCreated += 1
    }
  }

  console.log(
    `done — groups: +${groupsCreated}, scents: +${scentsCreated}, links: +${linksCreated}`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
