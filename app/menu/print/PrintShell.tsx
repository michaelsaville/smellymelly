'use client'

import { useEffect } from 'react'

// Adds the `sm-print` body class so menu.css print rules engage, and pops
// the print dialog automatically on first load. Mel can also re-open it
// from the toolbar button below — the button is hidden when actually
// printing via the @media print rule.
//
// Orientation is admin-configurable via SM_Settings.menuOrientation
// (set in /admin/menu/layout). Whatever the singleton row says, we
// inject a matching @page size rule below — that's the only place
// orientation lives in CSS, so flipping it survives a page refresh
// without code changes.
export function PrintShell({
  children,
  orientation = 'LANDSCAPE',
}: {
  children: React.ReactNode
  orientation?: 'LANDSCAPE' | 'PORTRAIT'
}) {
  useEffect(() => {
    document.body.classList.add('sm-print')
    const t = setTimeout(() => window.print(), 250)
    return () => {
      clearTimeout(t)
      document.body.classList.remove('sm-print')
    }
  }, [])

  const pageSize =
    orientation === 'PORTRAIT' ? 'letter portrait' : 'letter landscape'

  return (
    <>
      <div className="sm-print-toolbar">
        <button onClick={() => window.print()}>Print</button>
        <a href="/admin/menu">Back to admin</a>
      </div>
      {children}
      {/* Orientation-specific @page rule. Lives here (not in menu.css)
          so the singleton SM_Settings.menuOrientation drives it. */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${pageSize};
            margin: 0.5in;
          }
        }
      `}</style>
      <style jsx global>{`
        .sm-print-toolbar {
          position: fixed;
          top: 0.5rem;
          right: 0.5rem;
          z-index: 1000;
          display: flex;
          gap: 0.5rem;
          background: #fff;
          padding: 0.4rem 0.6rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.85rem;
        }
        .sm-print-toolbar button {
          cursor: pointer;
          border: 1px solid #c8557a;
          background: #c8557a;
          color: #fff;
          padding: 0.25rem 0.7rem;
          border-radius: 6px;
        }
        .sm-print-toolbar a {
          color: #6a3a4a;
          text-decoration: none;
          padding: 0.25rem 0.4rem;
        }
        @media print {
          .sm-print-toolbar {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
