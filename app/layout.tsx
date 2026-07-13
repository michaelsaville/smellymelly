import type { Metadata, Viewport } from 'next'
import { prisma } from '@/app/lib/prisma'
import './globals.css'
import ServiceWorkerRegister from '@/app/components/ServiceWorkerRegister'

const SITE_URL = process.env.PUBLIC_URL || 'https://smellymelly.net'
const SITE_NAME = 'Smelly Melly'
const DEFAULT_DESCRIPTION =
  'Handcrafted body butter, bath salts, body scrub, wax melts, room fragrance, and lip balm — made by hand in small batches in Cumberland, Maryland.'

/**
 * Dynamic so we can attach the favicon routes only when a logo has
 * been uploaded — browsers cache 404s for favicons hard, and an
 * advertised-but-missing icon triggers that on every cold load.
 */
export async function generateMetadata(): Promise<Metadata> {
  let hasLogo = false
  try {
    const settings = await prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
      select: { logoUrl: true },
    })
    hasLogo = !!settings?.logoUrl
  } catch {
    // Fall through — metadata still renders cleanly without icons.
  }

  const base: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${SITE_NAME} — Handmade Bath & Body`,
      template: `%s · ${SITE_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: SITE_NAME,
    appleWebApp: { capable: true, statusBarStyle: 'default', title: SITE_NAME },
    authors: [{ name: 'Smelly Melly' }],
    keywords: [
      'handmade body butter',
      'bath salts',
      'body scrub',
      'wax melts',
      'room fragrance',
      'lip balm',
      'bath and body',
      'Cumberland Maryland',
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
    robots: { index: true, follow: true },
  }

  if (hasLogo) {
    base.icons = {
      icon: [
        { url: '/api/favicon/16', sizes: '16x16', type: 'image/png' },
        { url: '/api/favicon/32', sizes: '32x32', type: 'image/png' },
        { url: '/api/favicon/192', sizes: '192x192', type: 'image/png' },
        { url: '/api/favicon/512', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: '/api/favicon/180', sizes: '180x180', type: 'image/png' },
      ],
    }
  }

  return base
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
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
