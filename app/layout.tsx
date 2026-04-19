import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = process.env.PUBLIC_URL || 'https://smellymelly.net'
const SITE_NAME = 'Smelly Melly'
const DEFAULT_DESCRIPTION =
  'Handcrafted candles, soaps, bath bombs, lip balm, beard balm, and more — made by hand in small batches in West Virginia.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Handmade Bath & Body`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: 'Smelly Melly' }],
  keywords: [
    'handmade soap',
    'candles',
    'bath bombs',
    'lip balm',
    'beard balm',
    'bath and body',
    'West Virginia',
    'small batch',
    'natural skincare',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME} — Handmade Bath & Body`,
    description: DEFAULT_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Handmade Bath & Body`,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#C67D4A',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
