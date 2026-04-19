import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    "Questions about a product, a custom order, or a wholesale inquiry? Send us a note and we'll get back to you.",
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
