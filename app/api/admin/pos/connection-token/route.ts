import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getStripe, isStripeConfigured } from '@/app/lib/stripe'

/**
 * Connection tokens for the Stripe Terminal iOS SDK running inside the native
 * POS shell. See NATIVE-POS-SHELL.md for the whole picture.
 *
 * Why it lives under /api/admin: middleware treats that prefix as an admin
 * path and passes it through maintenance mode untouched. A /api/pos/* route
 * would hit isBlockablePublicApi() and 503 the moment Mel flips maintenance
 * on — the till would stop taking cards for a reason nobody would ever
 * connect back to that toggle.
 *
 * Auth is the same sm_admin cookie as the rest of admin. The shell copies it
 * out of the WKWebView cookie store onto the SDK's URLSession request, so
 * there is no second credential baked into the app binary to leak or rotate.
 *
 * A token secret can connect to ANY reader on the account and take payments,
 * so per Stripe's own warning this is CSRF-guarded too: a browser cannot set
 * X-SM-POS-Native on a cross-origin POST without a preflight this route never
 * answers, and the SDK's URLSession sets it on every call.
 */

const NATIVE_HEADER = 'x-sm-pos-native'

/**
 * A Bluetooth reader must be registered to a Terminal Location when it
 * connects, so the shell needs one alongside the token. It comes from here
 * rather than the app binary so it can be changed without a TestFlight build.
 *
 * STRIPE_TERMINAL_LOCATION_ID pins it. With that unset we fall back to the
 * first location on the account, which is only safe while there is effectively
 * one — the account currently has two both named "Default", so pin it.
 * Cached because connection tokens are fetched on every reader connect and
 * refresh, and the location never moves.
 */
let cachedLocationId: string | null = null

async function getLocationId(): Promise<string | null> {
  if (process.env.STRIPE_TERMINAL_LOCATION_ID) {
    return process.env.STRIPE_TERMINAL_LOCATION_ID
  }
  if (cachedLocationId) return cachedLocationId
  try {
    const res = await getStripe().terminal.locations.list({ limit: 1 })
    cachedLocationId = res.data[0]?.id ?? null
    return cachedLocationId
  } catch {
    // Not fatal on its own — the shell reports "no location" far more
    // usefully than a dead token request would.
    return null
  }
}

async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get('sm_admin')?.value === 'sm_authenticated'
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!req.headers.get(NATIVE_HEADER)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured yet.' }, { status: 503 })
  }

  try {
    const [token, locationId] = await Promise.all([
      getStripe().terminal.connectionTokens.create(),
      getLocationId(),
    ])
    return NextResponse.json({ secret: token.secret, locationId })
  } catch (err) {
    console.error('[pos/connection-token]', err)
    // The SDK surfaces this string to Mel when a reader won't connect, so it
    // has to read like something she can act on rather than a stack trace.
    return NextResponse.json(
      { error: 'Could not reach Stripe to authorise the reader.' },
      { status: 502 },
    )
  }
}
