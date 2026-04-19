# Smoke Test Checklist — Mel's Manual Pass

This doc is the things **a human has to eyeball** before we turn on
`smellymelly.net`. Everything in here is either visual (does it look right?)
or depends on real third-party accounts we can't fake (Square, USPS,
Gmail, card readers). Tick each box as you go; if something's off, write
the quirk next to it and we'll fix it together.

---

## 0. Before you start

- [ ] `LAUNCH-CHECKLIST.md` credentials are filled in on the server
      (Square, EasyPost, `GMAIL_APP_PASSWORD`, strong `ADMIN_PASSWORD`)
- [ ] The app has been rebuilt since the last commit you're testing
      (`docker compose build app && docker compose up -d app`)
- [ ] You're testing from a real device/browser — **phone** and **laptop**
      both. Most bugs only show on mobile.

---

## 1. Storefront — public site

Visit https://smellymelly.net (or `100.115.11.109:3002` on tailscale).

### 1.1 Look & feel
- [ ] **Home** — hero reads nicely, shop/about buttons fit on mobile
      without overlap, featured categories grid is clean
- [ ] **Shop** — category filter chips wrap nicely on mobile
- [ ] **Product detail** — main image looks sharp, variant selector works,
      "Add to cart" button is reachable without scrolling weirdly
- [ ] **About** — your story reads the way you want it to
- [ ] **Contact** — form is clean, state + zip sit side by side on phone
- [ ] **Footer** — Shop, Policies, and copyright all visible on every page

### 1.2 Policy pages
- [ ] `/terms` loads, reads like you expect
- [ ] `/privacy` loads
- [ ] `/refund-policy` loads
- [ ] Nothing in any of these pages contradicts how you *actually* want
      to run the business (dates, return windows, etc.)

### 1.3 SEO sanity (optional, nerdy)
- [ ] `/sitemap.xml` returns XML with all pages including current products
- [ ] `/robots.txt` shows `Disallow: /admin`, `/api/`, `/cart`, etc.

---

## 2. Cart → Checkout → Order confirmation

Use a **personal email** you can check for incoming mail during this run.

### 2.1 Cart
- [ ] Add 2–3 variants to cart from different products
- [ ] `/cart` shows all items with thumbnails, right prices, right totals
- [ ] Update quantity +/- works; removing an item works
- [ ] Refreshing the page keeps the cart (localStorage)

### 2.2 Checkout — shipping
- [ ] Pick "Ship" fulfillment
- [ ] Type a real address — shipping rates populate within a few seconds
      (EasyPost live; falls back to flat $5.99 if EasyPost is down)
- [ ] Pick a rate, total updates correctly = subtotal + shipping + tax
- [ ] Square payment form renders (card input visible)
- [ ] Enter a **real card**, submit, small amount
- [ ] See confirmation page with order number
- [ ] Email arrives within ~1 minute with correct order # and items
- [ ] Open **Square dashboard** → confirm the payment appears

### 2.3 Checkout — pickup
- [ ] Start a new checkout, pick "Local pickup"
- [ ] Shipping section disappears
- [ ] Complete checkout (Square still charges full amount)
- [ ] Order confirmation email arrives

### 2.4 Edge cases
- [ ] Try to check out with **0 items** — should be blocked
- [ ] Try an incomplete shipping address on a ship order — blocked with
      a clear error
- [ ] Close the browser mid-checkout, come back — cart is still intact

---

## 3. Admin — product & inventory

Login at `/admin/login` with `ADMIN_PASSWORD`.

- [ ] Dashboard shows recent orders, low-stock callouts
- [ ] **Products** list loads; editing a product works; adding a variant
      works; uploading a product image works
- [ ] **Scents** page: add a scent, deactivate one
- [ ] **Inventory** page: adjusting stock shows immediately
- [ ] **Materials** + **Recipes**: still work as before (no regressions)
- [ ] **AI** page: existing product/recipe flows still work

---

## 4. Admin — orders

### 4.1 Order list
- [ ] `/admin/orders` shows your recent test orders
- [ ] Clicking an order # takes you to the detail page

### 4.2 Order detail — ship order
- [ ] Items, totals, customer, ship-to all render correctly
- [ ] "Buy USPS Label (EasyPost)" button appears — **only click on a
      live test order you're OK shipping**
- [ ] After clicking Buy Label: status flips to SHIPPED, tracking shows,
      "View/print label" link works and downloads a PDF
- [ ] Customer gets shipping notification email with tracking number

### 4.3 Order detail — manual ship
- [ ] On another ship order, use "Mark Shipped" with a typed tracking
      number
- [ ] Customer gets shipping email (tracking is whatever you typed)

### 4.4 Pickup workflow
- [ ] On a pickup order: advance status PAID → PROCESSING → READY FOR
      PICKUP → PICKED UP
- [ ] Status chips update after each click

### 4.5 Cancel
- [ ] On a PAID order, click "Cancel Order", confirm the prompt
- [ ] Order shows as CANCELLED; "cancelledAt" date is present
- [ ] (Manual step: refund the customer in Square dashboard if you
      charged them)

---

## 5. Admin — customers (CRM)

### 5.1 List
- [ ] `/admin/customers` shows every customer your test orders touched
- [ ] Search by name and by email works
- [ ] Every segment chip works: all, repeat, big spenders, new, dormant,
      has shipped, pickup only

### 5.2 Profile
- [ ] Click a customer → profile shows stats (orders, lifetime spend,
      since date)
- [ ] Order history table lists every order with links to order detail
- [ ] Last ship-to snapshot shows the address from the most recent ship
      order
- [ ] **Activity timeline** (bottom of page) is in reverse-chronological
      order: customer-created, orders placed, orders paid/shipped, notes,
      emails sent

### 5.3 Tags
- [ ] Create a new tag ("VIP", "wholesale", etc.)
- [ ] Apply it — the chip turns solid color
- [ ] Remove it — the chip goes back to outline
- [ ] In the customer list, tags show inline on each row

### 5.4 Notes
- [ ] Type a note, hit Save — "Saved" appears
- [ ] Reload the page — note persists
- [ ] Notes field supports line breaks

### 5.5 CSV export
- [ ] Hit "Export CSV" while on the "all" segment — file downloads
- [ ] Open in Excel/Sheets — headers look right, no weird quote
      corruption
- [ ] Switch segments (e.g. dormant), export again — only those
      customers appear in the file

---

## 6. AI assistant — CRM questions

On `/admin/ai`, try each prompt:

- [ ] "Who are my top 3 customers?" — returns a short bulleted list with
      names, order count, total spend
- [ ] "Who hasn't ordered in a while?" — returns dormant customers;
      offers to tag or note them (does NOT offer to email)
- [ ] "Tag jane@example.com as VIP" — succeeds; check the profile to
      confirm the tag is on
- [ ] "Add a note on sarah@example.com that she prefers unscented" —
      note appears dated on her profile
- [ ] "Give me an overview of my customer base" — returns segment
      counts

---

## 7. Phase 7 — broadcasts, wholesale, birthdays

### 7.1 Wholesale discount
- [ ] Pick a real customer's profile (or make a test customer by placing
      an order)
- [ ] Set "Wholesale discount (%)" to `15`, Save Profile
- [ ] Place a **new test order** using **the same email address**
- [ ] Verify on the confirmation screen and email that the subtotal is
      reduced by 15%
- [ ] Reset wholesale % to 0 after testing

### 7.2 Birthday
- [ ] Set a customer's birthday to **today's date**, Save Profile
- [ ] On their profile, click "Birthday · Send now" — customer receives
      the birthday email
- [ ] "Last sent" updates to the current year
- [ ] Click again — it still sends, but also still records

### 7.3 Thank-you broadcast
- [ ] On `/admin/customers`, Broadcasts card → "Thank-you emails" →
      **Preview**: should list customers whose first order was 6–14 days
      ago and who have never received one
- [ ] If the count is non-zero and you're OK with it, click "Send all"
- [ ] Spot-check a recipient: they got the email; their profile shows
      "Thank-you · Last sent: today"

### 7.4 Re-engagement broadcast
- [ ] Broadcasts card → "Re-engagement (dormant)" → **Preview**: should
      list customers whose last order was 90+ days ago
- [ ] Click "Send all" if comfortable
- [ ] Spot-check a recipient got the email

### 7.5 Birthday broadcast
- [ ] Broadcasts card → "Birthday emails" → **Preview**: should list
      customers whose birthday is today
- [ ] Click "Send all"
- [ ] Recipients each receive their birthday email

---

## 8. Mobile pass

Do this on an actual phone (or Chrome DevTools mobile mode if you must).

- [ ] Home, shop, product detail, about, contact, policies — all read
      well without horizontal scroll
- [ ] Nav hamburger opens, menu items work
- [ ] Footer columns stack nicely on narrow screens
- [ ] Cart page is usable (qty +/- buttons tappable)
- [ ] Checkout form is fillable without zooming
- [ ] Square card input is tappable and legible
- [ ] Admin pages (orders, customers) at least load and are usable —
      admin isn't the mobile priority but shouldn't be broken

---

## 9. Email sanity

- [ ] Order confirmation renders correctly in **Gmail**, **Apple Mail**,
      and **Outlook** if you can — the template uses inline styles but
      clients vary
- [ ] Shipping notification email has working tracking number
- [ ] Links in email footer point to `smellymelly.net` (not localhost or
      an IP)
- [ ] No emails land in spam (add sender to contacts if they do)

---

## 10. After-launch sanity (run once a week for the first month)

- [ ] Square dashboard balances match the orders list totals
- [ ] No CANCELLED orders that never got a Square refund
- [ ] Low-stock alerts on dashboard match reality
- [ ] Spot-check a dormant-customer run — make sure you're not
      accidentally emailing the same person every week (the 90-day
      cooldown should prevent this, but verify)

---

## What to do when you find something

Small typo or wording fix: just tell Michael, he'll patch it.

Functional bug: **write down the steps** you took and what happened vs
what you expected. The more specific, the faster the fix.

Data concern (wrong totals, missed email, etc.): **don't delete
anything**. Screenshot or copy the state, then we'll dig in together.
