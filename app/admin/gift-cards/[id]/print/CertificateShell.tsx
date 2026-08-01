'use client'

import { useEffect } from 'react'

/**
 * Mirrors the scent-sheet print shell: body class, auto-pop the print dialog,
 * a screen-only toolbar. One certificate per page, portrait letter.
 */
export default function CertificateShell({
  children,
  backHref,
}: {
  children: React.ReactNode
  backHref: string
}) {
  useEffect(() => {
    document.body.classList.add('sm-cert-print')
    const t = setTimeout(() => window.print(), 250)
    return () => {
      clearTimeout(t)
      document.body.classList.remove('sm-cert-print')
    }
  }, [])

  return (
    <>
      <div className="sm-print-toolbar">
        <button onClick={() => window.print()}>Print</button>
        <a href={backHref}>Back</a>
      </div>
      {children}
      <style jsx global>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          .sm-print-toolbar {
            display: none;
          }
          /* Certificates are the whole point of the page — keep the ink. */
          .sm-cert {
            break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        body.sm-cert-print {
          background: #fff;
        }
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
      `}</style>
    </>
  )
}
