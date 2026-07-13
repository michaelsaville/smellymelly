// Read-only star rating display.
export default function Stars({
  rating,
  className = 'text-base',
}: {
  rating: number
  className?: string
}) {
  const full = Math.round(rating)
  return (
    <span className={className} aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? 'text-amber-500' : 'text-brand-warm/50'}>
          ★
        </span>
      ))}
    </span>
  )
}
