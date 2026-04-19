import type { MetadataRoute } from 'next'

const SITE_URL = (process.env.PUBLIC_URL || 'https://smellymelly.net').replace(
  /\/+$/,
  '',
)

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/', '/cart', '/checkout', '/order/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
