# Native POS shell — driving the Stripe Reader M2 from the register

**Status:** server + web half built and deployed (2026-09-09). Native app not started.
**Read this first if you are the Claude Code session running on the MacBook.**

---

## Why this exists

Mel bought a **Stripe Reader M2**. It connects over Bluetooth LE and is
compatible with the **iOS / Android / React Native Terminal SDKs only** — no
JavaScript SDK, no server-driven API. iOS Safari has no Web Bluetooth at all,
so the web register can never speak to it directly. The server-driven path
already in `app/lib/actions/terminal.ts` works only with Stripe's *smart*
readers (WisePOS E, S700/S710, Verifone), which is a different piece of
hardware we don't own.

The fix is **not** a native POS. It is a thin shell whose only job is Bluetooth:

```
┌─ iOS app ──────────────────────────────────────────────┐
│  WKWebView  →  https://smellymellys.net/admin/pos       │ ← the register, unchanged
│  WKScriptMessageHandler "smPay"  ⇄  JS bridge           │
│  StripeTerminal SDK              ⇄  M2 over Bluetooth   │
└─────────────────────────────────────────────────────────┘
```

Mel sees the register she already knows. The shell contributes one thing: turning
an amount into a **succeeded PaymentIntent**. `createPosSale` then records the
order exactly as it does for every other tender, and `SM_Order.stripePaymentIntentId`
is `@unique`, so the existing double-charge guard covers this path for free.

**Do not** reimplement cart, stock, receipts, or gift cards natively. If you find
yourself writing product UI in Swift, you have taken a wrong turn.

---

## What already exists on the server side

| Piece | Path | Notes |
|---|---|---|
| Connection tokens | `POST /api/admin/pos/connection-token` | Returns `{ secret, locationId }` |
| Card-present intent | `startSdkCardPayment()` in `app/lib/actions/pos-sdk-card.ts` | Returns `{ clientSecret, paymentIntentId }`, `capture_method: automatic` |
| Void an untapped intent | `cancelSdkCardPayment()`, same file | Refuses to cancel one that already took money |
| Browser bridge client | `app/lib/pos-native.ts` | The contract below, already wired into the tender sheet |

The web page fetches the client secret itself and passes it across the bridge.
**The native side never needs to mint a PaymentIntent** — its only authenticated
call to our server is the connection token.

### Authenticating the connection token request

Two non-obvious requirements, both enforced server-side:

1. **Cookie.** The endpoint uses the same `sm_admin` cookie as the rest of admin.
   The SDK's `ConnectionTokenProvider` runs on its own `URLSession`, which does
   **not** share the WKWebView cookie jar. Copy the cookie out of
   `WKWebsiteDataStore.default().httpCookieStore` and set it on the request.
   This is deliberate — it means no second credential is baked into the binary.
2. **`X-SM-POS-Native: 1` header.** Required, or you get a 403. A connection
   token secret can connect to any reader on the account and take payments, so
   per Stripe's own warning the route is CSRF-guarded; a browser cannot set a
   custom header on a cross-origin POST without a preflight this route never
   answers.

If the cookie is missing or stale the endpoint returns 401 and the SDK surfaces
it as a connect failure. Handle that by sending the webview back to
`/admin/login` rather than showing a Stripe error — the real problem is that
Mel is logged out.

---

## The bridge contract

Already implemented on the web side in `app/lib/pos-native.ts`. Implement the
native half to match exactly.

**At document start**, inject:

```js
window.smPayNative = { version: 1 }
```

This is how the register knows it is inside the shell. Without it the POS
silently falls back to the keyed-card path and no M2 option ever appears —
which is also the correct behaviour in plain Safari.

**Web → native**, via `window.webkit.messageHandlers.smPay.postMessage(...)`:

```jsonc
{ "id": "pay_…", "action": "collect", "clientSecret": "pi_…_secret_…", "amountCents": 1850 }
{ "id": "pay_…", "action": "cancel" }
```

**Native → web**, by evaluating `window.smPayEvent({...})`:

```jsonc
{ "type": "reader",  "label": "Mel's M2" }          // or label: null on disconnect
{ "type": "status",  "id": "pay_…", "message": "Insert or tap card" }
{ "type": "result",  "id": "pay_…", "ok": true,  "paymentIntentId": "pi_…" }
{ "type": "result",  "id": "pay_…", "ok": false, "error": "The card was declined." }
```

Rules the web side depends on:

- **Send a `reader` event on every connect and disconnect**, including once
  shortly after load if a reader is already paired. The Card option in the
  tender sheet appears and disappears off the back of this.
- **Exactly one `result` per `id`.** The promise on the web side settles once.
- **`status` messages are Mel-facing.** The M2 has no screen, so pass through
  `Terminal.stringFromReaderInputOptions` and `stringFromReaderDisplayMessage`
  verbatim. Without them she is holding a silent brick.
- **Own the retry-on-decline loop natively, against the same PaymentIntent.**
  Stripe is explicit: a second intent for a declined card is a second
  authorisation on the customer. Only send a `result` when the attempt is
  genuinely over.
- **`error` strings are shown to Mel as-is.** Write sentences, not error codes.

---

## Native implementation notes

**SDK:** Swift Package Manager, `https://github.com/stripe/stripe-terminal-ios-spm`.
Current major is 5.x, built with Xcode 26 / Swift 6.2, minimum **iOS 15**. If the
Mac is on an older macOS that can't run Xcode 26, pin an older SDK major rather
than forcing an OS upgrade.

**Info.plist** — all three are required; the app crashes on first launch without
the Bluetooth key:

| Key | Value |
|---|---|
| `NSLocationWhenInUseUsageDescription` | Location access is required to accept payments. |
| `NSBluetoothAlwaysUsageDescription` | This app uses Bluetooth to connect to the card reader. |
| `UIBackgroundModes` | array containing `bluetooth-central` |

Location is not optional decoration — if the SDK can't determine the device's
location, **Stripe disables payments entirely**.

**No Apple entitlement is needed.** The `com.apple.developer.proximity-reader.payment.acceptance`
entitlement is for Tap to Pay on iPhone only, and requires Apple's approval.
Bluetooth readers need nothing. Don't go down that path.

**Connect flow:** `discoverReaders(.bluetoothScan)` → `connectBluetoothReader(_:delegate:connectionConfig:)`
with a `BluetoothConnectionConfiguration(locationId:)` built from the `locationId`
the token endpoint returns. Persist the reader's serial and reconnect on launch —
Mel should not be re-pairing at a market.

**Payment flow:** `retrievePaymentIntent(clientSecret:)` → `collectPaymentMethod` →
`confirmPaymentIntent`. With `capture_method: automatic` (which the server sets) a
successful confirm lands on `succeeded` and **there is no capture step**. If you
find yourself writing a capture call, the server changed and this doc is stale.

**Firmware updates are the field-failure risk.** The M2 will want an update on
first connect and it can run several minutes. Implement
`reader(_:didStartInstallingUpdate:cancelable:)` and the progress delegate and
show a real progress bar. Mel will assume the reader is broken otherwise, and
she'll be at a market when it happens.

---

## Testing

1. **Swap to test keys first.** `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`
   in `~/smellymelly/.env.local` are `sk_live` — every tap is real money. Stripe
   publishes physical test cards for Terminal; an amount ending in `00` approves.
2. Then one small live sale, confirm the order appears in `/admin/orders` with the
   right `stripePaymentIntentId`, and refund it from the Stripe dashboard.
3. Check the keyed fallback still works — the "Type the card in instead" link
   under the charge button is the escape hatch for a card the M2 won't read.

## Distribution

Michael has the paid Apple Developer Program membership. Use **TestFlight**, not a
cabled install: Mel's iPad lives at markets and a cabled build means a drive to
Cumberland every time we ship a fix.

---

## Loose ends on the Stripe account

- There are **two Terminal locations both named "Default"** (`tml_GmDk5wZOt3qX6S`
  and `tml_Gjf7mQAKkKFjzt`). Delete one in the dashboard, then set
  `STRIPE_TERMINAL_LOCATION_ID` in `.env.local` to pin the survivor. Until that's
  done the endpoint falls back to whichever the API lists first.
- `tmr_GjlVCQkFQbXCF1` (`mobile_phone_reader`) is a **Tap to Pay** registration
  from something outside the register — not the M2. Leave it alone, but don't be
  confused by it when the M2 shows up in the reader list.
