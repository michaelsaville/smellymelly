import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer'

export interface OrderFormVariant {
  id: string
  productName: string
  variantName: string
  scent: string | null
  category: string
  priceCents: number
}

export interface OrderFormProduct {
  id: string
  name: string
  category: string
  description: string | null
  imageBuffer: Buffer | null
  variants: OrderFormVariant[] // variants for this product, ordered by price asc
}

export interface OrderFormData {
  businessName: string
  businessPhone: string | null
  businessEmail: string | null
  paymentNote: string // e.g. "Pay by Venmo @melissaj, Cash App $MellyJ, or cash on delivery"
  products: OrderFormProduct[]
}

const COLORS = {
  brown: '#4A2E1E',
  terra: '#C67D4A',
  warm: '#F4E8D8',
  muted: '#8A7060',
  border: '#D8C4A8',
  black: '#1C1208',
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: COLORS.black,
  },
  header: {
    borderBottom: `2pt solid ${COLORS.terra}`,
    paddingBottom: 8,
    marginBottom: 10,
  },
  brand: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.brown,
  },
  tagline: {
    fontSize: 9,
    color: COLORS.muted,
    marginTop: 2,
  },
  pageTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.terra,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  instructions: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 10,
    lineHeight: 1.4,
  },

  // ── Catalog grid ──────────────────────────────────────────────────────
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginLeft: -4,
    marginRight: -4,
  },
  catalogCell: {
    width: '33.333%',
    padding: 4,
  },
  catalogCard: {
    border: `0.5pt solid ${COLORS.border}`,
    borderRadius: 4,
    padding: 6,
    minHeight: 170,
    backgroundColor: '#FFFEFB',
  },
  catalogImage: {
    width: '100%',
    height: 80,
    objectFit: 'contain',
    marginBottom: 4,
  },
  catalogImagePlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: COLORS.warm,
    marginBottom: 4,
  },
  catalogProduct: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.brown,
  },
  catalogCategory: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  catalogPrice: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.terra,
    marginTop: 3,
  },
  catalogVariantCount: {
    fontSize: 7,
    color: COLORS.muted,
    marginTop: 2,
  },

  // ── Order form (back) ─────────────────────────────────────────────────
  customerBlock: {
    border: `1pt solid ${COLORS.brown}`,
    borderRadius: 4,
    padding: 8,
    marginBottom: 10,
    backgroundColor: '#FFFEFB',
  },
  customerRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  customerField: {
    flex: 1,
    marginRight: 8,
  },
  customerLabel: {
    fontSize: 7,
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerLine: {
    borderBottom: `0.5pt solid ${COLORS.brown}`,
    height: 14,
    marginTop: 1,
  },

  orderTable: {
    border: `0.5pt solid ${COLORS.brown}`,
  },
  orderHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.warm,
    borderBottom: `0.5pt solid ${COLORS.brown}`,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  orderHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.brown,
    textTransform: 'uppercase',
  },
  orderRow: {
    flexDirection: 'row',
    borderBottom: `0.25pt solid ${COLORS.border}`,
    paddingVertical: 3,
    paddingHorizontal: 4,
    minHeight: 18,
    alignItems: 'center',
  },
  orderRowAlt: {
    backgroundColor: '#FAF6EE',
  },
  colProduct: { width: '42%', fontSize: 9 },
  colVariant: { width: '28%', fontSize: 8, color: COLORS.muted },
  colPrice: { width: '14%', fontSize: 9, textAlign: 'right' },
  colQty: {
    width: '16%',
    textAlign: 'center',
  },
  qtyBox: {
    border: `0.5pt solid ${COLORS.brown}`,
    height: 14,
    width: 40,
    marginLeft: 'auto',
    marginRight: 'auto',
    backgroundColor: 'white',
  },

  totalsRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  totalsLabel: {
    width: '84%',
    textAlign: 'right',
    paddingRight: 6,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.brown,
  },
  totalsBox: {
    width: '16%',
    height: 14,
    border: `0.5pt solid ${COLORS.brown}`,
    backgroundColor: 'white',
  },

  footer: {
    position: 'absolute',
    bottom: 16,
    left: 28,
    right: 28,
    borderTop: `0.5pt solid ${COLORS.border}`,
    paddingTop: 4,
    fontSize: 7,
    color: COLORS.muted,
    textAlign: 'center',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 4,
    right: 28,
    fontSize: 7,
    color: COLORS.muted,
  },
})

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function priceRange(variants: OrderFormVariant[]): string {
  if (variants.length === 0) return ''
  const prices = variants.map((v) => v.priceCents).sort((a, b) => a - b)
  const min = prices[0]
  const max = prices[prices.length - 1]
  return min === max ? dollars(min) : `${dollars(min)} – ${dollars(max)}`
}

function CatalogCell({ p }: { p: OrderFormProduct }) {
  return (
    <View style={styles.catalogCell}>
      <View style={styles.catalogCard} wrap={false}>
        {p.imageBuffer ? (
          <Image
            src={{ data: p.imageBuffer, format: 'jpg' }}
            style={styles.catalogImage}
          />
        ) : (
          <View style={styles.catalogImagePlaceholder} />
        )}
        <Text style={styles.catalogProduct}>{p.name}</Text>
        <Text style={styles.catalogCategory}>{p.category}</Text>
        <Text style={styles.catalogPrice}>{priceRange(p.variants)}</Text>
        <Text style={styles.catalogVariantCount}>
          {p.variants.length} option{p.variants.length === 1 ? '' : 's'} available —
          see back for full list
        </Text>
      </View>
    </View>
  )
}

function OrderFormRow({ v, alt }: { v: OrderFormVariant; alt: boolean }) {
  return (
    <View style={[styles.orderRow, alt ? styles.orderRowAlt : {}]} wrap={false}>
      <Text style={styles.colProduct}> </Text>
      <Text style={styles.colVariant}>{v.variantName}</Text>
      <Text style={styles.colPrice}>{dollars(v.priceCents)}</Text>
      <View style={styles.colQty}>
        <View style={styles.qtyBox} />
      </View>
    </View>
  )
}

function OrderFormGroupHeader({ productName }: { productName: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: COLORS.brown,
        paddingVertical: 3,
        paddingHorizontal: 4,
      }}
      wrap={false}
    >
      <Text
        style={{
          fontSize: 9,
          fontFamily: 'Helvetica-Bold',
          color: 'white',
          flex: 1,
        }}
      >
        {productName}
      </Text>
    </View>
  )
}

export function OrderFormDocument({ data }: { data: OrderFormData }) {
  // Group products by category for the catalog front.
  const productsByCategory = new Map<string, OrderFormProduct[]>()
  for (const p of data.products) {
    const list = productsByCategory.get(p.category) ?? []
    list.push(p)
    productsByCategory.set(p.category, list)
  }
  const categories = Array.from(productsByCategory.keys()).sort()

  // Flattened variant list (keeps product-grouping) for the order grid back.
  const orderRows: Array<
    | { kind: 'header'; productName: string }
    | { kind: 'variant'; v: OrderFormVariant; alt: boolean }
  > = []
  for (const p of data.products) {
    if (p.variants.length === 0) continue
    orderRows.push({ kind: 'header', productName: p.name })
    p.variants.forEach((v, i) => {
      orderRows.push({ kind: 'variant', v, alt: i % 2 === 1 })
    })
  }

  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Document>
      {/* FRONT — catalog */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{data.businessName}</Text>
          <Text style={styles.tagline}>
            Handcrafted bath & body · {data.businessPhone ?? ''}
            {data.businessPhone && data.businessEmail ? ' · ' : ''}
            {data.businessEmail ?? ''}
          </Text>
        </View>

        <Text style={styles.pageTitle}>Product Menu</Text>
        <Text style={styles.instructions}>
          Pick what you&apos;d like on the back of this sheet. Return it to
          the drop-off contact by the deadline and we&apos;ll deliver your
          order.
        </Text>

        {categories.map((cat) => {
          const prods = productsByCategory.get(cat)!
          return (
            <View key={cat} wrap={true}>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: 'Helvetica-Bold',
                  color: COLORS.brown,
                  marginTop: 8,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.8,
                }}
              >
                {cat}
              </Text>
              <View style={styles.catalogGrid}>
                {prods.map((p) => (
                  <CatalogCell key={p.id} p={p} />
                ))}
              </View>
            </View>
          )
        })}

        <Text style={styles.footer}>
          Flip over to place your order →
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* BACK — order form */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{data.businessName} · Order Form</Text>
          <Text style={styles.tagline}>Printed {todayStr}</Text>
        </View>

        {/* Customer info */}
        <View style={styles.customerBlock}>
          <View style={styles.customerRow}>
            <View style={styles.customerField}>
              <Text style={styles.customerLabel}>Name</Text>
              <View style={styles.customerLine} />
            </View>
            <View style={styles.customerField}>
              <Text style={styles.customerLabel}>Phone</Text>
              <View style={styles.customerLine} />
            </View>
          </View>
          <View style={styles.customerRow}>
            <View style={styles.customerField}>
              <Text style={styles.customerLabel}>Room / Unit / Address</Text>
              <View style={styles.customerLine} />
            </View>
            <View style={styles.customerField}>
              <Text style={styles.customerLabel}>Email (optional)</Text>
              <View style={styles.customerLine} />
            </View>
          </View>
          <View style={styles.customerRow}>
            <View style={[styles.customerField, { flex: 2 }]}>
              <Text style={styles.customerLabel}>Notes / Special requests</Text>
              <View style={styles.customerLine} />
            </View>
          </View>
        </View>

        <Text style={styles.pageTitle}>Write quantity in the box next to each item you want</Text>

        <View style={styles.orderTable}>
          <View style={styles.orderHeader} fixed>
            <Text style={[styles.orderHeaderCell, styles.colProduct]}>Product</Text>
            <Text style={[styles.orderHeaderCell, styles.colVariant]}>Scent / Size</Text>
            <Text style={[styles.orderHeaderCell, styles.colPrice]}>Price</Text>
            <Text style={[styles.orderHeaderCell, styles.colQty]}>Qty</Text>
          </View>
          {orderRows.map((row, i) =>
            row.kind === 'header' ? (
              <OrderFormGroupHeader key={`h-${i}`} productName={row.productName} />
            ) : (
              <OrderFormRow key={row.v.id} v={row.v} alt={row.alt} />
            ),
          )}
        </View>

        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Total items ordered</Text>
          <View style={styles.totalsBox} />
        </View>

        <View style={{ marginTop: 10, padding: 6, border: `0.5pt dashed ${COLORS.terra}` }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.brown, marginBottom: 3 }}>
            Payment
          </Text>
          <Text style={{ fontSize: 8, color: COLORS.muted, lineHeight: 1.4 }}>
            {data.paymentNote}
          </Text>
        </View>

        <Text style={styles.footer}>
          Thank you for supporting handmade! · {data.businessName}
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
