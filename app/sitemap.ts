import type { MetadataRoute } from 'next'
import { prisma } from '@/app/lib/prisma'

const SITE_URL = (process.env.PUBLIC_URL || 'https://smellymelly.net').replace(
  /\/+$/,
  '',
)

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/shop`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/refund-policy`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // Dynamic product pages. If DB isn't reachable, fall back to statics.
  try {
    const products = await prisma.sM_Product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    })
    const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
      url: `${SITE_URL}/shop/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))
    return [...staticRoutes, ...productRoutes]
  } catch (err) {
    console.error('[sitemap] product fetch failed, returning statics only:', err)
    return staticRoutes
  }
}
