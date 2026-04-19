# Payment Methods — Shipped, Deferred, and Why

Mel already takes **Facebook Pay, Venmo, and Cash App** through her
personal accounts. This doc captures what the website supports today and
what we decided to put off, so future-us doesn't re-litigate the same
trade-offs.

---

## ✅ Shipped (2026-04-19)

### 1. Square — Credit / Debit Card
Already in place. Uses Square Web Payments SDK. Recorded on the order as
`paymentMethod = SQUARE_CARD`.

### 2. Square — Cash App Pay
Shipped as code; not yet *tested live* because Square credentials aren't
set up yet.

- Uses `payments.cashAppPay(paymentRequest, { redirectURL, referenceId })`
  from the same Square Web Payments SDK — same library, second button.
- Customer clicks "Cash App Pay", gets redirected to the Cash App mobile
  deep-link (or QR code on desktop), approves the charge, and Square
  returns a source token the same way the card form does.
- Zero additional merchant account needed — just needs Cash App Pay
  **enabled in the Square Dashboard** (Payments → Accept Payments →
  toggle Cash App Pay).
- Square's fee for Cash App Pay is the same as card (2.9% + $0.30 at
  the time of writing, check current rate).
- Recorded as `paymentMethod = SQUARE_CASH_APP`.

**When real Square creds land:** test a live Cash App Pay charge with a
small amount, confirm the Square dashboard shows it, refund it, delete.

### 3. Manual tender — "Pay directly via Venmo / Cash App"
The thing Mel has actually been doing for months.

- Customer picks this at checkout. Order is created with status `PENDING`
  and `paymentMethod = MANUAL`. No Square call.
- Confirmation screen + email show the Venmo handle and Cash App cashtag
  pulled from `SM_Settings` (editable on `/admin/settings`).
- Admin sees the order on `/admin/orders/[id]` with a prominent "Awaiting
  manual payment" callout and a **Mark as Paid** button that takes an
  optional note ("Venmo 4/19", "Cash in person", etc.).
- After marking paid, the order flows through the normal workflow
  (PROCESSING → SHIPPED / READY_FOR_PICKUP / ...).
- For pickup orders, the UI wording flexes to "Pay at pickup (cash,
  Venmo, or Cash App)" since that's the common case.

**Fees:** none to Smelly Melly. This is the free option.

**Trade-off:** not auto-reconciled. Mel has to match incoming money to
orders by the memo line. That's the price of no fees. The `#0042`-in-memo
instruction baked into the email is how we keep matching painless.

---

## ⚠️ Deferred — PayPal / Venmo (online SDK)

Venmo-on-a-website is **PayPal's product**. To accept Venmo as an online
checkout button, you integrate PayPal Checkout and enable Venmo as one
of the "smart buttons" it surfaces (Venmo only shows up for US mobile
users who have the Venmo app installed).

**Not shipped because:**
- Requires a **PayPal Business** account, separate from Mel's personal
  Venmo. Sign-up, identity verification, bank link, tax info.
- Separate SDK (`@paypal/react-paypal-js` or similar), separate checkout
  component, separate server-side order-capture flow.
- PayPal's fees stack on top of Square's existing fees — there's no
  reason to dual-process. We'd either fully migrate to PayPal or keep
  Square for cards and PayPal only for Venmo/PayPal users.
- Real-world benefit is marginal when the manual Venmo option already
  works for 100% of Venmo users (who happily send P2P anyway).

**Revisit when:** Mel wants automated reconciliation for Venmo orders,
OR she's scaled enough that manually matching Venmo payments is eating
noticeable time. Estimate: 4-6 hours to integrate, plus PayPal Business
account setup on her side.

---

## ❌ Not possible on this site — Facebook Pay / Meta Pay

**Meta Pay is only available inside Meta's own surfaces**: Facebook
Shop, Instagram Shop, and Messenger. Meta does not publish a SDK that
lets an independent website embed their checkout.

**If Mel wants Meta Pay specifically**, the only path is to set up a
**Facebook / Instagram Shop** and list products there (separately, or
via a Shopify/BigCommerce integration that does the sync). Customers who
go through the FB/IG Shop checkout flow can pay with Meta Pay natively.

That's a different business model decision — do products live in Shopify
(with FB/IG sync) or on the website we've built? Worth a separate
conversation with Mel.

---

## 🕰️ Longer-term ideas (low priority)

- **Stripe as a backup processor** — if Square ever has an outage or
  freezes Mel's account, having a fallback saves the weekend. Stripe
  Payment Element is similarly plug-and-play.
- **Bank transfer (Plaid / ACH)** for wholesale accounts — larger
  invoices where 2.9% + $0.30 on hundreds of dollars adds up. Plaid
  Link + Stripe ACH is the standard stack.
- **Automated Venmo reconciliation** via Plaid's transactions API —
  matches incoming Venmo deposits to pending `MANUAL` orders by amount.
  Cute but probably never worth the engineering cost for a one-person
  business.

---

## Summary table

| Method | Status | Who sees it | Fee to Mel | Reconciliation |
|---|---|---|---|---|
| Card (Square) | ✅ Built | Everyone at checkout | ~2.9% + $0.30 | Automatic |
| Cash App Pay (Square) | ✅ Built, untested live | Everyone (button on checkout) | ~2.9% + $0.30 | Automatic |
| Manual Venmo / Cash App | ✅ Built, live today | Everyone at checkout | $0 | Manual — match by memo |
| PayPal / Venmo SDK | ⚠️ Deferred | — | ~2.9% + $0.30 | Automatic |
| Meta Pay | ❌ Not possible here | Only in FB/IG Shop | — | — |
