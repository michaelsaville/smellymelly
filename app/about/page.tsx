import type { Metadata } from 'next'
import StoreLayout from '@/app/components/StoreLayout'
import { getPageTextMany } from '@/app/lib/page-text'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Meet Mel — the maker behind Smelly Melly. Small-batch body butter, bath salts, wax melts, and lip balm handcrafted in Cumberland, Maryland.',
}

export const dynamic = 'force-dynamic'

export default async function AboutPage() {
  const text = await getPageTextMany([
    'about.hero_subtitle',
    'about.intro',
    'about.list_lead',
    'about.list_items',
    'about.middle',
    'about.quote',
    'about.quote_author',
    'about.closing',
    'about.contact_nudge',
  ])

  const bullets = text['about.list_items']
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return (
    <StoreLayout>
      <div className="bg-gradient-to-b from-brand-cream to-surface-warm py-16 px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl font-bold text-brand-dark text-center">
            About Smelly Melly
          </h1>
          <p className="mt-2 text-center text-brand-brown/60">
            {text['about.hero_subtitle']}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-16 space-y-6 text-brand-brown leading-relaxed">
        <Prose text={text['about.intro']} />

        <p>{text['about.list_lead']}</p>
        {bullets.length > 0 && (
          <ul className="list-disc pl-6 space-y-1">
            {bullets.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}

        <Prose text={text['about.middle']} />

        <div className="card bg-brand-cream/50 text-center">
          <p className="font-display text-xl font-semibold text-brand-terra">
            &ldquo;{text['about.quote']}&rdquo;
          </p>
          <p className="mt-2 text-sm text-brand-brown/60">
            &mdash; {text['about.quote_author']}
          </p>
        </div>

        <Prose text={text['about.closing']} />

        <p className="text-brand-brown/60 text-sm">
          {text['about.contact_nudge']}{' '}
          <a href="/contact" className="text-brand-terra hover:underline">
            Get in touch →
          </a>
        </p>
      </div>
    </StoreLayout>
  )
}

/** Render text that may contain blank-line paragraph breaks as separate <p> tags. */
function Prose({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  )
}
