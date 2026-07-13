'use client'

import { useEffect, useState } from 'react'

// Registers the service worker and, when a new version has installed behind an
// existing one, shows a gentle "refresh for the latest" prompt. Combined with
// the SW's network-first pages, this ends the installed-app stale-deploy trap.
export default function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            // Only prompt for a genuine UPDATE (a controller already exists),
            // not the very first install.
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(() => {
        // A failed SW registration must never break the app.
      })
  }, [])

  if (!updateReady) return null

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
      <div className="flex items-center gap-3 rounded-full bg-brand-dark text-white shadow-lg px-4 py-2.5 text-sm">
        <span>✨ A new version is ready.</span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-brand-terra px-3 py-1 font-medium hover:brightness-110"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
