# Smelly Melly

**E-commerce storefront + inventory management for a handmade bath & body products business.**

A lightweight, all-in-one platform for a single-owner small business selling handmade candles, soaps, bath bombs, lip balm, beard balm, and other bath & body products.

**Live domain:** [smellymelly.net](https://smellymelly.net)

---

## Features

### Public Storefront
- Product catalog with variants (scent × product type × size)
- Product photos with gallery
- Shopping cart + guest checkout (no account required)
- Square payment processing
- USPS shipping integration with rate calculator
- Local pickup option (no shipping fee)
- Mobile-responsive design

### Admin Dashboard (Owner-only)
- Product management: add/edit products with variants, photos, pricing
- Inventory tracking per variant (stock levels, low-stock alerts)
- Order management: view, fulfill, mark shipped/picked up
- Label printing: USPS shipping labels + product/inventory labels
- Basic invoicing: generate and send simple invoices
- Sales reports: daily/weekly/monthly revenue, top products

### Integrations
| Service | Purpose |
|---------|---------|
| Square | Payment processing (checkout + in-person) |
| USPS | Shipping rates + label generation |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Styling | Tailwind CSS |
| Payments | Square Web Payments SDK |
| Shipping | USPS Web Tools API (or EasyPost) |
| Hosting | Development: Docker on PCC2K server → Production: GoDaddy |

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
- `/shop` — Full product catalog with category filters
- `/shop/[slug]` — Product detail with variant selector
- `/cart` — Shopping cart
- `/checkout` — Guest checkout (shipping or local pickup)
- `/order/[id]` — Order confirmation / tracking
- `/about` — About Smelly Melly
- `/contact` — Contact form

### Admin (`/admin/*`)
- `/admin` — Dashboard (today's orders, revenue, low stock alerts)
- `/admin/products` — Product list, add/edit
- `/admin/products/new` — Create product with variants
- `/admin/orders` — Order list, fulfill, print labels
- `/admin/inventory` — Stock levels, adjust quantities
- `/admin/invoices` — Create and send invoices
- `/admin/labels` — Print product labels (barcode/QR optional)
- `/admin/settings` — Store settings, shipping rates, Square config

---

## Data Model Overview

### Core Models
- **Product** — name, slug, description, category, photos, isActive
- **ProductVariant** — productId, scent, type, size, price, costPrice, sku, stockQuantity, weight
- **Order** — customerName, email, phone, shippingAddress, fulfillment (SHIP/PICKUP), status, total
- **OrderItem** — orderId, variantId, quantity, unitPrice
- **Invoice** — orderId (optional), customerName, email, items, total, status, sentAt, paidAt

### Supporting
- **Category** — name, slug, sortOrder (Candles, Soaps, Bath & Body, Lip Care, Beard Care)
- **ShippingRate** — weightRange, zone, rate (or use USPS API for live rates)
- **StoreSettings** — singleton: business name, address, tax rate, Square keys, USPS credentials

---

## Status

**Planning phase** — not yet built.

---

Built by [PCC2K](https://pcc2k.com) for Smelly Melly
