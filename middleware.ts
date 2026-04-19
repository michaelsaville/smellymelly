import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/app/lib/prisma'

// Use the node runtime so Prisma works in middleware (default is edge).
export const config = {
  matcher: [
    // Skip static assets + _next internals. Everything else passes through
    // and the logic below decides what to do.
    '/((?!_next/|favicon.ico|robots.txt|sitemap.xml|uploads/|api/uploads/).*)',
  ],
}

export const runtime = 'nodejs'

// Simple in-process cache so we don't hammer the DB on every request.
// 10s is fast enough that flipping the toggle feels immediate.
const CACHE_TTL_MS = 10_000
let cache: { on: boolean; fetchedAt: number } | null = null

async function isMaintenanceOn(): Promise<boolean> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.on
  }
  try {
    const settings = await prisma.sM_Settings.findFirst({
      where: { id: 'singleton' },
      select: { maintenanceMode: true },
    })
    const on = settings?.maintenanceMode ?? false
    cache = { on, fetchedAt: Date.now() }
    return on
  } catch {
    // If the DB is unreachable, fail open — don't black-hole the whole site.
    return false
  }
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
}

function isMaintenancePath(pathname: string): boolean {
  return pathname === '/maintenance' || pathname.startsWith('/maintenance/')
}

// Public API routes that would let someone place an order or otherwise write
// through while maintenance is on. These get a 503 instead of a page rewrite.
function isBlockablePublicApi(pathname: string): boolean {
  if (!pathname.startsWith('/api/')) return false
  if (pathname.startsWith('/api/admin')) return false
  if (pathname.startsWith('/api/auth')) return false
  return true
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always let admin + maintenance page through untouched.
  if (isAdminPath(pathname) || isMaintenancePath(pathname)) {
    return NextResponse.next()
  }

  const maintenanceOn = await isMaintenanceOn()
  if (!maintenanceOn) return NextResponse.next()

  // Admin cookie bypass — lets Mel preview the real site while logged in.
  const hasAdminSession =
    req.cookies.get('sm_admin')?.value === 'sm_authenticated'
  if (hasAdminSession) return NextResponse.next()

  if (isBlockablePublicApi(pathname)) {
    return NextResponse.json(
      { error: 'Smelly Melly is temporarily offline for updates. Please try again shortly.' },
      { status: 503, headers: { 'Retry-After': '300' } },
    )
  }

  // Everything else — rewrite (not redirect) to /maintenance so the URL stays.
  const url = req.nextUrl.clone()
  url.pathname = '/maintenance'
  url.search = ''
  return NextResponse.rewrite(url, { status: 503 })
}
