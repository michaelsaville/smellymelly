import nodemailer, { type Transporter } from 'nodemailer'
import { prisma } from './prisma'
import type { SM_Order, SM_OrderItem } from '@prisma/client'

// ─── Config ─────────────────────────────────────────────────────────────
// Generic SMTP — works with Resend, Brevo, Gmail, or any SMTP provider. Set
// the EMAIL_SMTP_* vars in .env.local. Recommended: Resend (free 3,000/mo,
// sends from your own verified domain):
//   EMAIL_SMTP_HOST=smtp.resend.com
//   EMAIL_SMTP_PORT=465
//   EMAIL_SMTP_USER=resend
//   EMAIL_SMTP_PASS=<Resend API key>
//   EMAIL_FROM_ADDRESS=hello@smellymellys.net   (must be on the verified domain)
// The legacy GMAIL_USER / GMAIL_APP_PASSWORD vars still work as a fallback.

const SMTP_HOST =
  process.env.EMAIL_SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : undefined)
const SMTP_PORT = Number(
  process.env.EMAIL_SMTP_PORT || (process.env.GMAIL_USER ? '587' : '465'),
)
const SMTP_SECURE = process.env.EMAIL_SMTP_SECURE
  ? process.env.EMAIL_SMTP_SECURE === 'true'
  : SMTP_PORT === 465 // 465 = implicit TLS, 587 = STARTTLS
const SMTP_USER = process.env.EMAIL_SMTP_USER || process.env.GMAIL_USER
const SMTP_PASS = process.env.EMAIL_SMTP_PASS || process.env.GMAIL_APP_PASSWORD
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Smelly Melly'
// Visible From address. Providers like Resend/Brevo send from your domain, not
// from the SMTP username, so this is separate from SMTP_USER.
const FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS || process.env.GMAIL_USER || SMTP_USER
const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL || FROM_ADDRESS
const STORE_URL = process.env.PUBLIC_URL || 'https://smellymellys.net'

function isConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && FROM_ADDRESS)
}

let cachedTransport: Transporter | null = null
function getTransport(): Transporter | null {
  if (!isConfigured()) return null
  if (cachedTransport) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST!,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER!, pass: SMTP_PASS! },
  })
  return cachedTransport
}

interface SendInput {
  to: string
  subject: string
  text: string
  html: string
  replyTo?: string
}

async function send({ to, subject, text, html, replyTo }: SendInput): Promise<void> {
  const transport = getTransport()
  if (!transport) {
    console.log(`[email] SMTP not configured; would have sent "${subject}" to ${to}`)
    return
  }
  await transport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDRESS!}>`,
    to,
    subject,
    text,
    html,
    // Resend/domain sending is send-only, so default replies to the inbox Mel
    // actually reads. The contact-form relay overrides this with the customer's
    // address so Mel can reply straight to them.
    replyTo: replyTo || CONTACT_INBOX || undefined,
  })
}

// ─── Formatting helpers ─────────────────────────────────────────────────

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function orderTable(items: SM_OrderItem[]): { text: string; html: string } {
  const text = items
    .map(
      (i) =>
        `  ${i.quantity}× ${i.productName} — ${i.variantName}   ${money(i.totalCents)}`,
    )
    .join('\n')
  const html = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 12px 6px 0">${i.quantity}× ${escapeHtml(i.productName)}<br><span style="color:#8a7360;font-size:12px">${escapeHtml(i.variantName)}</span></td><td style="padding:6px 0;text-align:right">${money(i.totalCents)}</td></tr>`,
    )
    .join('')
  return { text, html }
}

// Minimal branded template. Matches the brand-terra (#C67D4A) accent used on
// the site. Inline styles because most mail clients strip <style>.
// Pulls the uploaded logo from settings when available — the image URL is
// absolutised against PUBLIC_URL so it renders inside the recipient's inbox.
async function wrap(title: string, bodyHtml: string): Promise<string> {
  let logoHtml = ''
  try {
    const settings = await prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
      select: { logoUrl: true },
    })
    if (settings?.logoUrl) {
      const absUrl = settings.logoUrl.startsWith('http')
        ? settings.logoUrl
        : `${STORE_URL.replace(/\/$/, '')}${settings.logoUrl}`
      logoHtml = `<div style="text-align:center;margin-bottom:16px"><img src="${absUrl}" alt="Smelly Melly" style="max-height:72px;width:auto"></div>`
    }
  } catch {
    // Logo is decorative; never block email on a settings read.
  }

  return `<!doctype html><html><body style="margin:0;font-family:Georgia,serif;background:#faf6f1;color:#3d2817">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:32px">
<tr><td>
${logoHtml}
<h1 style="margin:0 0 16px;font-size:24px;color:#C67D4A">${escapeHtml(title)}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="margin:0;font-size:12px;color:#8a7360">Smelly Melly — handmade bath &amp; body from Cumberland, Maryland<br><a href="${STORE_URL}" style="color:#C67D4A">${STORE_URL.replace(/^https?:\/\//, '')}</a></p>
</td></tr></table></td></tr></table></body></html>`
}

// ─── Senders ────────────────────────────────────────────────────────────

export async function sendOrderConfirmation(
  order: SM_Order & { items: SM_OrderItem[] },
): Promise<void> {
  const { text: itemsText, html: itemsHtml } = orderTable(order.items)
  const orderNum = String(order.orderNumber).padStart(4, '0')
  const isManual = order.paymentMethod === 'MANUAL'
  const subject = isManual
    ? `Order #${orderNum} — payment instructions inside`
    : `Order #${orderNum} — thanks for your order!`

  // For manual orders, pull the payment handles from settings so the buyer
  // gets the Venmo / Cash App info in the confirmation email.
  let paymentText = ''
  let paymentHtml = ''
  if (isManual) {
    const s = await prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: {
        venmoHandle: true,
        cashAppTag: true,
        paymentInstructions: true,
      },
    })
    const venmo = s?.venmoHandle?.trim()
    const cashApp = s?.cashAppTag?.trim()
    const extra = s?.paymentInstructions?.trim()

    const lines: string[] = [
      `\n=== HOW TO PAY ===`,
      `Your order is pending payment. Please send ${money(order.totalCents)} with #${orderNum} in the memo.`,
    ]
    if (venmo) lines.push(`Venmo: ${venmo}`)
    if (cashApp) lines.push(`Cash App: ${cashApp}`)
    if (!venmo && !cashApp) {
      lines.push(`I'll follow up with payment details shortly.`)
    }
    if (extra) lines.push(`\n${extra}`)
    paymentText = lines.join('\n') + '\n'

    const htmlRows: string[] = []
    if (venmo) {
      htmlRows.push(
        `<li style="margin:4px 0"><strong>Venmo:</strong> <span style="font-family:monospace;color:#C67D4A">${escapeHtml(venmo)}</span></li>`,
      )
    }
    if (cashApp) {
      htmlRows.push(
        `<li style="margin:4px 0"><strong>Cash App:</strong> <span style="font-family:monospace;color:#C67D4A">${escapeHtml(cashApp)}</span></li>`,
      )
    }
    paymentHtml = `
<div style="margin:24px 0;padding:16px;background:#fef3e2;border:1px solid #fbbf24;border-radius:8px">
<p style="margin:0 0 8px;font-weight:bold;color:#92400e">How to pay</p>
<p style="margin:0 0 12px;font-size:14px">Your order is pending payment. Please send <strong>${money(order.totalCents)}</strong> with <strong>#${orderNum}</strong> in the memo.</p>
${htmlRows.length ? `<ul style="margin:0;padding-left:20px;font-size:14px">${htmlRows.join('')}</ul>` : `<p style="margin:0;font-size:14px">I'll follow up with payment details shortly.</p>`}
${extra ? `<p style="margin:12px 0 0;padding-top:12px;border-top:1px solid #fbbf24;font-size:13px;white-space:pre-wrap">${escapeHtml(extra)}</p>` : ''}
</div>`
  }

  const totalsText = [
    `  Subtotal   ${money(order.subtotalCents)}`,
    order.shippingCents > 0 ? `  Shipping   ${money(order.shippingCents)}` : null,
    order.taxCents > 0 ? `  Tax        ${money(order.taxCents)}` : null,
    `  Total      ${money(order.totalCents)}`,
  ]
    .filter(Boolean)
    .join('\n')

  const shippingLine =
    order.fulfillment === 'SHIP'
      ? `\nShipping to:\n  ${order.shippingName}\n  ${order.shippingAddress}\n  ${order.shippingCity}, ${order.shippingState} ${order.shippingZip}\n`
      : `\nFulfillment: pickup\n`

  const text = `Hi ${order.customerName},

Thanks so much for your order! Here's a copy for your records.

Order #${orderNum}
${itemsText}

${totalsText}
${shippingLine}${paymentText}
${order.fulfillment === 'SHIP' ? "I'll send another email with tracking as soon as it ships." : "I'll reach out to coordinate pickup."}

— Mel`

  const totalsHtml = `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px">
<tr><td style="color:#8a7360">Subtotal</td><td style="text-align:right">${money(order.subtotalCents)}</td></tr>
${order.shippingCents > 0 ? `<tr><td style="color:#8a7360">Shipping</td><td style="text-align:right">${money(order.shippingCents)}</td></tr>` : ''}
${order.taxCents > 0 ? `<tr><td style="color:#8a7360">Tax</td><td style="text-align:right">${money(order.taxCents)}</td></tr>` : ''}
<tr><td style="padding-top:8px;border-top:1px solid #eee;font-weight:bold">Total</td><td style="padding-top:8px;border-top:1px solid #eee;text-align:right;font-weight:bold">${money(order.totalCents)}</td></tr>
</table>`

  const shippingHtml =
    order.fulfillment === 'SHIP'
      ? `<p style="margin:24px 0 0;font-size:14px"><strong>Shipping to:</strong><br>${escapeHtml(order.shippingName || '')}<br>${escapeHtml(order.shippingAddress || '')}<br>${escapeHtml(order.shippingCity || '')}, ${escapeHtml(order.shippingState || '')} ${escapeHtml(order.shippingZip || '')}</p>`
      : `<p style="margin:24px 0 0;font-size:14px"><strong>Fulfillment:</strong> pickup</p>`

  const html = await wrap(
    `Order #${orderNum}`,
    `<p>Hi ${escapeHtml(order.customerName)},</p>
<p>Thanks so much for your order! Here's a copy for your records.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px">${itemsHtml}</table>
${totalsHtml}
${shippingHtml}
${paymentHtml}
<p style="margin:24px 0 0;font-size:14px">${
      order.fulfillment === 'SHIP'
        ? "I'll send another email with tracking as soon as it ships."
        : "I'll reach out to coordinate pickup."
    }</p>
<p style="margin:24px 0 0;font-size:14px">— Mel</p>`,
  )

  await send({ to: order.customerEmail, subject, text, html })
}

/**
 * Receipt for an in-person (POS) sale that's ALREADY paid in hand. Unlike
 * sendOrderConfirmation this never asks the buyer to pay — it's a thank-you +
 * itemized receipt. No-ops cleanly (logs) until SMTP is configured.
 */
export async function sendPosReceipt(
  order: SM_Order & { items: SM_OrderItem[] },
): Promise<void> {
  const { text: itemsText, html: itemsHtml } = orderTable(order.items)
  const orderNum = String(order.orderNumber).padStart(4, '0')
  const subject = `Your Smelly Melly receipt — Order #${orderNum}`

  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:2px 12px 2px 0;${strong ? 'font-weight:bold' : 'color:#8a7360'}">${label}</td><td style="padding:2px 0;text-align:right;${strong ? 'font-weight:bold' : ''}">${value}</td></tr>`

  const totalsHtml =
    row('Subtotal', money(order.subtotalCents)) +
    (order.discountCents > 0
      ? row(`Discount${order.discountCode ? ` (${escapeHtml(order.discountCode)})` : ''}`, `−${money(order.discountCents)}`)
      : '') +
    (order.taxCents > 0 ? row('Tax', money(order.taxCents)) : '') +
    row('Total', money(order.totalCents), true)

  const paidLine = order.manualPaymentNote
    ? `<p style="margin:16px 0 0;font-size:13px;color:#8a7360">Paid in person · ${escapeHtml(order.manualPaymentNote)}</p>`
    : `<p style="margin:16px 0 0;font-size:13px;color:#8a7360">Paid in person.</p>`

  const html = await wrap(
    'Thanks for your purchase!',
    `<p style="margin:0 0 16px;font-size:14px">Here's your receipt for Order #${orderNum}.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
${itemsHtml}
<tr><td colspan="2" style="padding:8px 0"><hr style="border:none;border-top:1px solid #eee;margin:0"></td></tr>
${totalsHtml}
</table>
${paidLine}
<p style="margin:20px 0 0;font-size:14px">Thanks for supporting handmade — Mel</p>`,
  )

  const totalsText = [
    `Subtotal: ${money(order.subtotalCents)}`,
    order.discountCents > 0 ? `Discount: -${money(order.discountCents)}` : '',
    order.taxCents > 0 ? `Tax: ${money(order.taxCents)}` : '',
    `Total: ${money(order.totalCents)}`,
  ]
    .filter(Boolean)
    .join('\n')
  const text = `Thanks for your purchase!\n\nOrder #${orderNum}\n\n${itemsText}\n\n${totalsText}\n\nPaid in person${order.manualPaymentNote ? ` (${order.manualPaymentNote})` : ''}.\n\n— Mel, Smelly Melly`

  await send({ to: order.customerEmail, subject, text, html })
}

export async function sendShippingNotification(
  order: SM_Order & { items: SM_OrderItem[] },
): Promise<void> {
  if (!order.trackingNumber) {
    console.warn(`[email] sendShippingNotification called on order ${order.id} with no trackingNumber; skipping`)
    return
  }
  const orderNum = String(order.orderNumber).padStart(4, '0')
  const subject = `Order #${orderNum} has shipped!`
  const text = `Hi ${order.customerName},

Good news — your order is on its way!

Order #${orderNum}
Tracking: ${order.trackingNumber}

Thanks again for supporting a handmade small business. Enjoy!

— Mel`
  const html = await wrap(
    `Order #${orderNum} is on its way!`,
    `<p>Hi ${escapeHtml(order.customerName)},</p>
<p>Good news — your order has shipped.</p>
<p style="margin:16px 0;padding:12px 16px;background:#faf6f1;border-radius:8px;font-family:monospace">
Tracking: <strong>${escapeHtml(order.trackingNumber)}</strong>
</p>
<p style="margin:24px 0 0">Thanks again for supporting a handmade small business. Enjoy!</p>
<p style="margin:24px 0 0">— Mel</p>`,
  )
  await send({ to: order.customerEmail, subject, text, html })
}

// ─── Phase 7 senders (thank-you, re-engagement, birthday) ──────────────

interface CustomerLike {
  name: string
  email: string
}

export async function sendThankYouEmail(customer: CustomerLike): Promise<void> {
  const subject = `Thanks for trying Smelly Melly, ${customer.name.split(' ')[0]}!`
  const text = `Hi ${customer.name},

It's been about a week since your first Smelly Melly order, and I just wanted to say thanks. Every package I send out is something I'm proud of — it means a lot that you gave us a try.

If you loved what you got, I'd be so grateful if you'd share it with a friend or come back and try a new scent. If something wasn't quite right, please reply and tell me — I read every message.

— Mel
${STORE_URL}`
  const html = await wrap(
    `Thanks for giving us a try!`,
    `<p>Hi ${escapeHtml(customer.name)},</p>
<p>It's been about a week since your first Smelly Melly order, and I just wanted to say thanks. Every package I send out is something I'm proud of — it means a lot that you gave us a try.</p>
<p>If you loved what you got, I'd be so grateful if you shared it with a friend or came back and tried a new scent. If something wasn't quite right, please reply and tell me — I read every message.</p>
<p style="margin:24px 0 0">— Mel</p>`,
  )
  await send({ to: customer.email, subject, text, html })
}

export async function sendReEngagementEmail(customer: CustomerLike): Promise<void> {
  const subject = `We miss you at Smelly Melly 💐`
  const text = `Hi ${customer.name},

It's been a while! I've been making new scents and experimenting with some fun recipes since we last saw you. If you're due for a restock — or curious what's new — come take a peek.

Thanks for being part of the Smelly Melly story.

— Mel
${STORE_URL}`
  const html = await wrap(
    `We miss you!`,
    `<p>Hi ${escapeHtml(customer.name)},</p>
<p>It's been a while! I've been making new scents and experimenting with some fun recipes since we last saw you. If you're due for a restock — or curious what's new — come take a peek.</p>
<p style="margin:24px 0"><a href="${STORE_URL}/shop" style="display:inline-block;background:#C67D4A;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:500">See what's new</a></p>
<p>Thanks for being part of the Smelly Melly story.</p>
<p style="margin:24px 0 0">— Mel</p>`,
  )
  await send({ to: customer.email, subject, text, html })
}

export async function sendBirthdayEmail(customer: CustomerLike): Promise<void> {
  const subject = `Happy birthday, ${customer.name.split(' ')[0]}! 🎂`
  const text = `Happy birthday, ${customer.name}!

Hope your day is full of people who love you, your favorite foods, and a little bit of magic.

Thanks for being part of the Smelly Melly family.

— Mel
${STORE_URL}`
  const html = await wrap(
    `Happy birthday!`,
    `<p>Happy birthday, ${escapeHtml(customer.name)}! 🎂</p>
<p>Hope your day is full of people who love you, your favorite foods, and a little bit of magic.</p>
<p>Thanks for being part of the Smelly Melly family.</p>
<p style="margin:24px 0 0">— Mel</p>`,
  )
  await send({ to: customer.email, subject, text, html })
}

export async function sendContactFormRelay(input: {
  name: string
  email: string
  message: string
}): Promise<void> {
  if (!CONTACT_INBOX) {
    console.warn('[email] CONTACT_INBOX_EMAIL + GMAIL_USER both unset; cannot relay contact form')
    return
  }
  const subject = `Contact form: ${input.name}`
  const text = `New message from the Smelly Melly contact form.

From: ${input.name} <${input.email}>

${input.message}`
  const html = await wrap(
    'New contact-form message',
    `<p><strong>From:</strong> ${escapeHtml(input.name)} &lt;<a href="mailto:${encodeURIComponent(input.email)}" style="color:#C67D4A">${escapeHtml(input.email)}</a>&gt;</p>
<p style="margin:16px 0;padding:16px;background:#faf6f1;border-radius:8px;white-space:pre-wrap">${escapeHtml(input.message)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#8a7360">Reply directly to this email to respond — the sender's address is set as Reply-To.</p>`,
  )
  await send({ to: CONTACT_INBOX, subject, text, html, replyTo: input.email })
}

/**
 * Operational alert to the store owner (not a customer). Used for things that
 * need a human to look — e.g. a Stripe webhook seeing a captured payment with
 * no matching order. Best-effort: if SMTP isn't configured it just logs.
 */
export async function sendAdminAlert(input: {
  subject: string
  lines: string[]
}): Promise<void> {
  if (!CONTACT_INBOX) {
    console.warn(`[email] no admin inbox configured; alert dropped: ${input.subject}`)
    return
  }
  const text = input.lines.join('\n')
  const html = await wrap(
    input.subject,
    input.lines.map((l) => `<p style="margin:6px 0">${escapeHtml(l)}</p>`).join(''),
  )
  await send({ to: CONTACT_INBOX, subject: `[Smelly Melly] ${input.subject}`, text, html })
}
