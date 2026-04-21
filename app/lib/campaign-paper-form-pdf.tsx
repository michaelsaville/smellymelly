import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

/**
 * Paper roster form for a campaign — the "fundraiser sign-up sheet" style.
 * Multiple buyers fill out one sheet, each claiming a numbered row. Layout
 * auto-flips based on variant count so small campaigns get a roomy
 * buyers-as-rows table and larger ones get variants-as-rows with a buyer
 * legend.
 */

export interface CampaignPaperVariant {
  variantId: string
  label: string // "Body Butter · Vanilla - 4oz"
}

export interface CampaignPaperData {
  businessName: string
  campaignName: string
  hostName: string
  customerPriceCents: number
  variants: CampaignPaperVariant[]
  partyUrl: string | null
  /** How many buyer slots on this sheet. 15 is the default. */
  buyerSlots: number
}

const COLORS = {
  brown: '#4A2E1E',
  terra: '#C67D4A',
  warm: '#F4E8D8',
  muted: '#8A7060',
  border: '#D8C4A8',
  black: '#1C1208',
}

/** Threshold at which we flip from buyers-as-rows to variants-as-rows. */
const WIDE_THRESHOLD = 5

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: COLORS.black,
  },
  header: {
    borderBottom: `2pt solid ${COLORS.terra}`,
    paddingBottom: 6,
    marginBottom: 8,
  },
  brand: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.brown,
  },
  tagline: { fontSize: 9, color: COLORS.muted, marginTop: 2 },
  priceBadge: {
    marginTop: 6,
    padding: 4,
    backgroundColor: COLORS.warm,
    borderRadius: 3,
    fontSize: 9,
    color: COLORS.brown,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.terra,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 4,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  legendCell: {
    width: '50%',
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottom: `0.4pt solid ${COLORS.border}`,
    alignItems: 'center',
  },
  legendNum: {
    width: 14,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.brown,
  },
  legendName: {
    width: 90,
    fontSize: 7,
    color: COLORS.muted,
  },
  legendPhone: {
    flex: 1,
    fontSize: 7,
    color: COLORS.muted,
  },
  table: {
    border: `0.5pt solid ${COLORS.border}`,
    borderRadius: 2,
    marginTop: 2,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.warm,
    borderBottom: `0.7pt solid ${COLORS.border}`,
    alignItems: 'stretch',
  },
  tableHeaderCell: {
    padding: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.brown,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    borderRight: `0.4pt solid ${COLORS.border}`,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 20,
    borderBottom: `0.4pt solid ${COLORS.border}`,
    alignItems: 'stretch',
  },
  tableRowAlt: {
    flexDirection: 'row',
    minHeight: 20,
    borderBottom: `0.4pt solid ${COLORS.border}`,
    backgroundColor: '#FAF5EC',
    alignItems: 'stretch',
  },
  tableCell: {
    padding: 3,
    fontSize: 7,
    borderRight: `0.3pt solid ${COLORS.border}`,
  },
  qtyCell: {
    padding: 0,
    borderRight: `0.3pt solid ${COLORS.border}`,
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 24,
    right: 24,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 18,
    right: 24,
    fontSize: 7,
    color: COLORS.muted,
  },
})

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/** Buyers-as-rows layout. Works well when variants ≤ WIDE_THRESHOLD. */
function BuyersAsRows({ data }: { data: CampaignPaperData }) {
  const buyerCol = 20
  const nameCol = 90
  const phoneCol = 70
  const notesCol = 60
  const totalCol = 34
  const variantColsWidth = 520 - buyerCol - nameCol - phoneCol - notesCol - totalCol
  const perVariant = Math.max(32, variantColsWidth / Math.max(1, data.variants.length))

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        <Text style={[styles.tableHeaderCell, { width: buyerCol, textAlign: 'center' }]}>#</Text>
        <Text style={[styles.tableHeaderCell, { width: nameCol }]}>Buyer name</Text>
        <Text style={[styles.tableHeaderCell, { width: phoneCol }]}>Phone</Text>
        {data.variants.map((v) => (
          <Text
            key={v.variantId}
            style={[styles.tableHeaderCell, { width: perVariant, textAlign: 'center' }]}
          >
            {v.label}
          </Text>
        ))}
        <Text style={[styles.tableHeaderCell, { width: notesCol }]}>Notes</Text>
        <Text
          style={[styles.tableHeaderCell, { width: totalCol, textAlign: 'center', borderRight: 'none' }]}
        >
          Total
        </Text>
      </View>
      {Array.from({ length: data.buyerSlots }, (_, i) => {
        const alt = i % 2 === 1
        return (
          <View key={i} style={alt ? styles.tableRowAlt : styles.tableRow}>
            <Text style={[styles.tableCell, { width: buyerCol, textAlign: 'center', fontFamily: 'Helvetica-Bold', color: COLORS.brown }]}>
              {i + 1}
            </Text>
            <View style={[styles.tableCell, { width: nameCol }]} />
            <View style={[styles.tableCell, { width: phoneCol }]} />
            {data.variants.map((v) => (
              <View key={v.variantId} style={[styles.qtyCell, { width: perVariant }]} />
            ))}
            <View style={[styles.tableCell, { width: notesCol }]} />
            <View style={[styles.tableCell, { width: totalCol, borderRight: 'none' }]} />
          </View>
        )
      })}
    </View>
  )
}

/** Variants-as-rows layout — buyers become numbered columns 1..N. */
function VariantsAsRows({ data }: { data: CampaignPaperData }) {
  const productCol = 170
  const qtyCol = Math.max(18, (540 - productCol) / data.buyerSlots)

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow} fixed>
        <Text style={[styles.tableHeaderCell, { width: productCol }]}>Item</Text>
        {Array.from({ length: data.buyerSlots }, (_, i) => (
          <Text
            key={i}
            style={[
              styles.tableHeaderCell,
              {
                width: qtyCol,
                textAlign: 'center',
                borderRight: i === data.buyerSlots - 1 ? 'none' : undefined,
              },
            ]}
          >
            {i + 1}
          </Text>
        ))}
      </View>
      {data.variants.map((v, rowIdx) => {
        const alt = rowIdx % 2 === 1
        return (
          <View key={v.variantId} style={alt ? styles.tableRowAlt : styles.tableRow}>
            <Text style={[styles.tableCell, { width: productCol }]}>{v.label}</Text>
            {Array.from({ length: data.buyerSlots }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.qtyCell,
                  {
                    width: qtyCol,
                    borderRight: i === data.buyerSlots - 1 ? 'none' : undefined,
                  },
                ]}
              />
            ))}
          </View>
        )
      })}
    </View>
  )
}

function BuyerLegend({ buyerSlots }: { buyerSlots: number }) {
  return (
    <>
      <Text style={styles.sectionTitle}>Buyer legend — write each name + phone here</Text>
      <View style={styles.legendGrid}>
        {Array.from({ length: buyerSlots }, (_, i) => (
          <View key={i} style={styles.legendCell}>
            <Text style={styles.legendNum}>{i + 1}.</Text>
            <Text style={styles.legendName}>Name __________________</Text>
            <Text style={styles.legendPhone}>Phone __________________</Text>
          </View>
        ))}
      </View>
    </>
  )
}

export function CampaignPaperFormDocument({ data }: { data: CampaignPaperData }) {
  const wide = data.variants.length > WIDE_THRESHOLD
  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>
            {data.businessName} · {data.campaignName}
          </Text>
          <Text style={styles.tagline}>
            Host: {data.hostName} · Printed {todayStr}
          </Text>
        </View>

        <View style={styles.priceBadge}>
          <Text>
            Every item {formatMoney(data.customerPriceCents)} · Bring payment
            to {data.hostName} at the event
          </Text>
        </View>

        {wide && <BuyerLegend buyerSlots={data.buyerSlots} />}

        <Text style={styles.sectionTitle}>
          {wide
            ? 'Write quantity in each buyer\u2019s column'
            : 'Write quantity for each item; leave boxes blank for items not wanted'}
        </Text>

        {wide ? <VariantsAsRows data={data} /> : <BuyersAsRows data={data} />}

        <Text style={styles.footer} fixed>
          {data.partyUrl
            ? `Prefer to order online? ${data.partyUrl}  ·  ${data.businessName}`
            : `Thanks for supporting ${data.businessName}!`}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `${pageNumber} / ${totalPages}` : ''
          }
          fixed
        />
      </Page>
    </Document>
  )
}
