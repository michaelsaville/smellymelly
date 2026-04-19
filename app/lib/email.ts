import nodemailer, { type Transporter } from 'nodemailer'
import { prisma } from './prisma'
import type { SM_Order, SM_OrderItem } from '@prisma/client'

// ─── Config ─────────────────────────────────────────────────────────────
// App password from https://myaccount.google.com/apppasswords (requires 2FA on
// the Google account). Store in .env.local. Free Gmail caps at 500 recipients
// per day over SMTP — plenty for transactional mail at launch scale.

const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Smelly Melly'
const CONTACT_INBOX = process.env.CONTACT_INBOX_EMAIL || GMAIL_USER
const STORE_URL = process.env.PUBLIC_URL || 'https://smellymelly.net'

function isConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD)
}

let cachedTransport: Transporter | null = null
function getTransport(): Transporter | null {
  if (!isConfigured()) return null
  if (cachedTransport) return cachedTransport
  cachedTransport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER!, pass: GMAIL_APP_PASSWORD! },
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
    from: `"${FROM_NAME}" <${GMAIL_USER!}>`,
    to,
    subject,
    text,
    html,
    replyTo,
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
function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;font-family:Georgia,serif;background:#faf6f1;color:#3d2817">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f1;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:32px">
<tr><td>
<h1 style="margin:0 0 16px;font-size:24px;color:#C67D4A">${escapeHtml(title)}</h1>
${bodyHtml}
<hr style="border:none;border-top:1px solid #eee;margin:32px 0">
<p style="margin:0;font-size:12px;color:#8a7360">Smelly Melly — handmade bath &amp; body from West Virginia<br><a href="${STORE_URL}" style="color:#C67D4A">${STORE_URL.replace(/^https?:\/\//, '')}</a></p>
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

  const html = wrap(
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
  const html = wrap(
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
  const html = wrap(
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
  const html = wrap(
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
  const html = wrap(
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
  const html = wrap(
    'New contact-form message',
    `<p><strong>From:</strong> ${escapeHtml(input.name)} &lt;<a href="mailto:${encodeURIComponent(input.email)}" style="color:#C67D4A">${escapeHtml(input.email)}</a>&gt;</p>
<p style="margin:16px 0;padding:16px;background:#faf6f1;border-radius:8px;white-space:pre-wrap">${escapeHtml(input.message)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#8a7360">Reply directly to this email to respond — the sender's address is set as Reply-To.</p>`,
  )
  await send({ to: CONTACT_INBOX, subject, text, html, replyTo: input.email })
}
