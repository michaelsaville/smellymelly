import { requireAdmin } from '@/app/lib/admin-auth'
import { prisma } from '@/app/lib/prisma'
import ReviewModeration from './ReviewModeration'

export const dynamic = 'force-dynamic'

export default async function ReviewsAdminPage() {
  await requireAdmin()

  // Pending first, then newest.
  const reviews = await prisma.sM_Review.findMany({
    orderBy: [{ isApproved: 'asc' }, { createdAt: 'desc' }],
    include: { product: { select: { name: true } } },
  })

  const pending = reviews.filter((r) => !r.isApproved).length

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-brand-dark mb-2">Reviews</h1>
      <p className="text-sm text-brand-brown/60 mb-6">
        Approve reviews to show them on the storefront.
        {pending > 0 && <span className="ml-1 font-medium text-amber-700">{pending} pending.</span>}
      </p>

      <ReviewModeration
        reviews={reviews.map((r) => ({
          id: r.id,
          productName: r.product.name,
          authorName: r.authorName,
          rating: r.rating,
          title: r.title,
          body: r.body,
          isApproved: r.isApproved,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
