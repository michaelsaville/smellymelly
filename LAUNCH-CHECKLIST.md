# Launch Checklist

Production readiness items that can't be resolved in code — they need
credentials set, secrets rotated, or external services wired up. Check
each off before pointing `smellymelly.net` at this app.

---

## 1. Credentials (`.env.local` on the production host)

All of these live in `.env.local` — see `.env.example` for the template.
Until they're set, the code falls back gracefully (console logs instead
of real sends, flat shipping rate, unauth'd Square checkout blocked).

### Square Web Payments SDK
- [ ] `SQUARE_APPLICATION_ID` — from Square Developer dashboard → your app
- [ ] `SQUARE_ACCESS_TOKEN` — production access token (sandbox token for staging)
- [ ] `SQUARE_LOCATION_ID` — from Square dashboard → Locations
- [ ] `SQUARE_ENVIRONMENT` — `sandbox` for testing, `production` for live
- [ ] Test a real card charge end-to-end (small amount, then refund via Square dashboard)

### EasyPost (USPS rates + label purchase)
- [ ] `EASYPOST_API_KEY` — from easypost.com dashboard (test key first, then production)
- [ ] `SHIP_FROM_STREET`
- [ ] `SHIP_FROM_CITY`
- [ ] `SHIP_FROM_STATE`
- [ ] `SHIP_FROM_ZIP`
- [ ] `SHIP_FROM_PHONE`
- [ ] Buy a single test label, verify the PDF downloads from the admin order page

### Gmail SMTP (transactional email)
- [ ] `GMAIL_USER` — the Gmail address that will be the sender
- [ ] `GMAIL_APP_PASSWORD` — generate at https://myaccount.google.com/apppasswords
      (requires 2FA on the Google account)
- [ ] `EMAIL_FROM_NAME` — defaults to "Smelly Melly"
- [ ] `CONTACT_INBOX_EMAIL` — where contact-form messages are relayed;
      defaults to `GMAIL_USER`
- [ ] `PUBLIC_URL` — `https://smellymelly.net`
- [ ] Trigger a test order, verify order-confirmation + shipping emails land

---

## 2. Secrets hygiene

- [ ] **Rotate `ANTHROPIC_API_KEY`** — the current key was exposed in dev
      (`.env.local` was committed earlier in project history).
      Generate a new one at console.anthropic.com, delete the old one.
- [ ] **Change `ADMIN_PASSWORD`** — the default is weak and was shared in
      chat. Pick something strong (20+ chars, password manager).
- [ ] **Flip `DISABLE_SECURE_COOKIES=false`** in production. Dev leaves
      it `true` so cookies work over plain HTTP on the LAN.
- [ ] Confirm `.env.local` is **not** in git: `git ls-files | grep '\.env'`
      should only show `.env.example`.
- [ ] Confirm the production host has the prod `.env.local` (not a copy
      of the dev one with sandbox keys).

---

## After both sections are green

1. Rebuild the image on prod: `docker compose build app && docker compose up -d app`
2. Place one real end-to-end order (ship + pickup both)
3. Point `smellymelly.net` DNS at the prod server
4. Set up a backup cron for the `smellymelly` Postgres schema
