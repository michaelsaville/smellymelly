# Smelly Melly

**E-commerce storefront + inventory management for a handmade bath & body products business.**

A lightweight, all-in-one platform for a single-owner small business selling handmade candles, soaps, bath bombs, lip balm, beard balm, and other bath & body products.

**Live domain:** [smellymellys.net](https://smellymellys.net)

---

## Features

### Public Storefront
- Product catalog with variants (scent × product type × size), search + sort
- Low-stock urgency badges ("Only N left")
- Scent-finder quiz (`/scent-finder`) with deep-links that pre-select a scent
- Product photos with gallery + reviews
- Shopping cart + guest checkout (no account required)
- **Stripe** embedded Payment Element (card) + Apple/Google Pay; manual tender
  (Venmo / Cash App / pickup) as a fallback
- Promo / discount codes at checkout
- Gift options + gift-set collection
- EasyPost shipping integration with live rate calculator; local pickup option
- Order tracking (`/track`) + installable PWA
- Custom & wholesale request intake (`/custom-orders`)
- Site-wide announcement banner
- Mobile-responsive design

### Admin Dashboard (Owner-only)
- **New Sale (POS)** — mobile ring-up for in-person / market sales; deducts stock
- Product management: add/edit/duplicate products with variants, photos, pricing
- Inventory tracking per variant (stock levels, low-stock alerts, quick ±1 adjust)
- Order management: filter-aware views, saved views, CSV export, inline + bulk
  status, fulfill, print labels
- Production spine: materials (on-hand / reorder), recipes, make-a-batch
  (deducts materials, restocks variants, computes unit cost)
- Fundraiser campaigns + paper order forms
- Promo codes, reviews moderation, customer CRM
- Invoicing with customer-facing card **pay links** (custom / wholesale)
- Sales + tax/profit reports
- Store settings: contact, tax, disclaimer, announcement banner, logo/favicon,
  maintenance mode

### Integrations
| Service | Purpose |
|---------|---------|
| Stripe | Card payments — storefront checkout + invoice pay links |
| EasyPost | Shipping rates + label generation |
| Gmail (SMTP) | Order-confirmation + notification email (pending credentials) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript |
| Database | PostgreSQL (shared `dochub` server, `smellymelly` schema) |
| ORM | Prisma 6 |
| Styling | Tailwind CSS |
| Payments | Stripe (embedded Payment Element) |
| Shipping | EasyPost |
| Hosting | Docker (prod-standalone) on the PCC2K server, behind nginx |

---

## Product Variant System

Smelly Melly's products have multiple variant dimensions:

```
Product: "Lavender Dreams"
├── Type: Candle
│   ├── 8oz tin  — $12.00
│   └── 16oz jar — $20.00
├── Type: Wax Melt
│   └── 6-pack   — $8.00
├── Type: Soap Bar
│   └── 4oz bar  — $6.00
└── Type: Lip Balm
    └── 0.15oz tube — $4.00
```

A "scent" (like Lavender Dreams) can span multiple product types, each with their own size, price, and inventory count.

---

## Pages

### Public
- `/` — Home / landing page with featured products
- `/shop` — Full product catalog with category filters, search + sort
- `/shop/[slug]` — Product detail with variant selector (honors `?scent=`)
- `/scent-finder` — Scent-matching quiz
- `/gifts` — Gift-set collection
- `/cart` — Shopping cart
- `/checkout` — Guest checkout (Stripe card / manual; promo codes)
- `/order/[id]` — Order confirmation
- `/track` — Order status lookup (order # + email)
- `/invoice/[token]` — Customer-facing invoice pay page
- `/custom-orders` — Custom & wholesale request intake
- `/party/[slug]` — Fundraiser campaign storefront
- `/about`, `/contact`

### Admin (`/admin/*`)
- `/admin` — Dashboard (today's orders, revenue, low stock alerts)
- `/admin/pos` — New Sale (mobile POS)
- `/admin/products` — Product list, add/edit/duplicate
- `/admin/orders` — Order list, saved views, CSV, fulfill, print labels
- `/admin/inventory` — Stock levels, quick ±1 + set adjust
- `/admin/production`, `/admin/materials`, `/admin/recipes` — make-a-batch spine
- `/admin/campaigns` — Fundraiser campaigns
- `/admin/discounts` — Promo codes
- `/admin/invoices` — Invoices + customer pay links
- `/admin/reviews` — Review moderation
- `/admin/reports` — Sales / tax / profit
- `/admin/settings` — Store settings, tax, announcement banner, logo

---

## Data Model Overview

### Core Models
- **Product** — name, slug, description, category, photos, isActive
- **ProductVariant** — productId, scent, type, size, price, costPrice, sku, stockQuantity, weight
- **Order** — customerName, email, phone, shippingAddress, fulfillment (SHIP/PICKUP), status, total
- **OrderItem** — orderId, variantId, quantity, unitPrice
- **Invoice** — orderId (optional), customerName, email, items, total, status, sentAt, paidAt

### Supporting
- **Category** — name, slug, sortOrder, base ingredients
- **DiscountCode** — code, PERCENT/FIXED value, maxUses, minSubtotal, expiry
- **Material / Recipe / RecipeItem** — cost-of-goods + make-a-batch production
- **Campaign / Host** — fundraiser storefronts + magic-link hosts
- **Review**, **Inquiry** (custom/wholesale), **Customer** (CRM)
- **Settings** — singleton: business info, tax rate, announcement banner,
  disclaimer, manual-payment handles, maintenance mode

---

## Status

**Live** at [smellymellys.net](https://smellymellys.net) (currently in maintenance
mode by owner request). Card payments via Stripe are active. Email features
(order confirmations, notifications) await Gmail SMTP credentials.

### Build / deploy
Prod-standalone Docker image — no hot-reload. After any source change:
```
docker compose build app && docker compose up -d app
```
After a schema change, `prisma db push` runs via a one-shot `node:20-alpine`
container on the `dochub_default` network (DB `db:5432` only resolves inside it).

---

Built by [PCC2K](https://pcc2k.com) for Smelly Melly
