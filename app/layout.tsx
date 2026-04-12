import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Smelly Melly — Handmade Bath & Body',
  description:
    'Handcrafted candles, soaps, bath bombs, lip balm, beard balm, and more. Made with love.',
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
