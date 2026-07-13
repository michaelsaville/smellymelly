// Smelly Melly service worker.
// Goal: make the installed home-screen app SELF-UPDATING (kill the stale-deploy
// trap) and allow basic offline reading — without ever serving stale HTML while
// online. Strategy:
//   • pages / navigations  -> network-first (fresh when online, cache offline)
//   • /_next/static/*       -> cache-first (content-hashed, immutable)
//   • /api/* and anything else -> passthrough (never cached)
// Bump VERSION to invalidate old caches on the next deploy.
const VERSION = 'sm-v1'
const PAGE_CACHE = `pages-${VERSION}`
const ASSET_CACHE = `assets-${VERSION}`

self.addEventListener('install', () => {
  // Activate this worker as soon as it's installed (paired with the page's
  // "update available" prompt, this is what ends the stale-deploy caching).
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // dynamic — never cache

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE))
  }
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const res = await fetch(request)
  if (res.ok) cache.put(request, res.clone())
  return res
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const hit = await cache.match(request)
    if (hit) return hit
    const home = await cache.match('/')
    if (home) return home
    return new Response('You are offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
