import type { MetadataRoute } from 'next'
import { prisma } from '@/app/lib/prisma'

// Dynamic so icons are only advertised when a logo exists (the favicon routes
// 404 without one, and browsers cache icon 404s hard).
export const dynamic = 'force-dynamic'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let hasLogo = false
  try {
    const s = await prisma.sM_Settings.findUnique({
      where: { id: 'singleton' },
      select: { logoUrl: true },
    })
    hasLogo = !!s?.logoUrl
  } catch {
    // Manifest still valid without icons.
  }

  const icons: MetadataRoute.Manifest['icons'] = hasLogo
    ? [
        { src: '/api/favicon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/api/favicon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/api/favicon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : []

  return {
    name: 'Smelly Melly',
    short_name: 'Smelly Melly',
    description: 'Handmade bath & body — body butter, bath salts, scrubs, wax melts & more.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBF6F0',
    theme_color: '#C67D4A',
    icons,
  }
}
