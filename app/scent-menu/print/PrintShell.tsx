'use client'

import { useEffect } from 'react'

// Mirrors scent-descriptions/print/PrintShell — body class, auto-pop the
// print dialog, inject an orientation-aware @page rule. Separate component
// so the bistro menu can be tuned without touching the plain sheet.
export function ScentMenuPrintShell({
  children,
  orientation = 'PORTRAIT',
}: {
  children: React.ReactNode
  orientation?: 'LANDSCAPE' | 'PORTRAIT'
}) {
  useEffect(() => {
    document.body.classList.add('sm-sheet-print')
    const t = setTimeout(() => window.print(), 250)
    return () => {
      clearTimeout(t)
      document.body.classList.remove('sm-sheet-print')
    }
  }, [])

  const pageSize =
    orientation === 'LANDSCAPE' ? 'letter landscape' : 'letter portrait'

  return (
    <>
      <div className="sm-print-toolbar">
        <button onClick={() => window.print()}>Print</button>
        <a href="/admin/scents/descriptions">Back to admin</a>
      </div>
      {children}
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
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 0.85rem;
        }
        .sm-print-toolbar button {
          cursor: pointer;
          border: 1px solid #c67d4a;
          background: #c67d4a;
          color: #fff;
          padding: 0.25rem 0.7rem;
          border-radius: 6px;
        }
        .sm-print-toolbar a {
          color: #7a5a48;
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
