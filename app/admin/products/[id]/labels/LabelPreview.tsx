'use client'

import { useState, useRef, useCallback } from 'react'

/**
 * Niimbot 50x30mm label generator
 * 50mm wide x 30mm tall
 */

const LABEL_W = '50mm'
const LABEL_H = '30mm'
// Pixel dimensions for canvas export (300 DPI: 50mm ≈ 591px, 30mm ≈ 354px)
const CANVAS_W = 591
const CANVAS_H = 354

type LabelEntry = { scent: string; variantName: string }

export default function LabelPreview({
  productName,
  labels,
  ingredients,
}: {
  productName: string
  labels: LabelEntry[]
  ingredients: string
}) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(labels.map((_, i) => i)),
  )
  const [copies, setCopies] = useState(1)

  const ingredientList = ingredients
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  function toggleLabel(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(labels.map((_, i) => i)))
  }

  function selectNone() {
    setSelected(new Set())
  }

  function handlePrint() {
    window.print()
  }

  // Download a single label as PNG (for Niimbot app import)
  const downloadLabel = useCallback(
    (type: 'front' | 'back', scent: string) => {
      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_W
      canvas.height = CANVAS_H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      ctx.fillStyle = '#000000'
      ctx.textAlign = 'center'

      if (type === 'front') {
        ctx.font = 'bold 36px sans-serif'
        ctx.fillText('Smelly Mellys', CANVAS_W / 2, 80)
        ctx.font = '26px sans-serif'
        ctx.fillStyle = '#333333'
        ctx.fillText('240-362-9354', CANVAS_W / 2, 120)
        ctx.fillStyle = '#000000'
        ctx.font = 'bold 32px sans-serif'
        ctx.fillText(scent, CANVAS_W / 2, 220)
        ctx.font = '26px sans-serif'
        ctx.fillStyle = '#444444'
        ctx.fillText(productName, CANVAS_W / 2, 265)
      } else {
        ctx.font = 'bold 22px sans-serif'
        ctx.fillText('Ingredients', CANVAS_W / 2, 50)
        ctx.font = '20px sans-serif'
        ctx.fillStyle = '#333333'
        const text = ingredientList.join(', ')
        wrapText(ctx, text, CANVAS_W / 2, 90, CANVAS_W - 40, 26)
      }

      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const safeName = scent.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        a.download = `${safeName}_${type}.png`
        a.click()
        URL.revokeObjectURL(url)
      })
    },
    [ingredientList, productName],
  )

  const selectedLabels = labels.filter((_, i) => selected.has(i))

  return (
    <div>
      {/* Controls — hidden when printing */}
      <div className="print:hidden mb-6 card space-y-4">
        <h2 className="font-display text-lg font-semibold text-brand-dark">
          Print Settings
        </h2>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="mb-1 block text-sm font-medium text-brand-brown">
              Copies each
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={copies}
              onChange={(e) =>
                setCopies(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="input w-24 text-sm"
            />
          </div>
          <button
            onClick={handlePrint}
            disabled={selectedLabels.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            Print {selectedLabels.length} Label
            {selectedLabels.length !== 1 ? 's' : ''}
          </button>
        </div>
        <p className="text-xs text-brand-brown/50">
          Set your printer to 50 x 30 mm paper with no margins. Or download
          individual label images and import them into the Niimbot app.
        </p>
      </div>

      {/* Label selection */}
      <div className="print:hidden mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-display text-lg font-semibold text-brand-dark">
            Labels ({labels.length})
          </h2>
          <button
            onClick={selectAll}
            className="text-xs text-brand-terra hover:underline"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="text-xs text-brand-terra hover:underline"
          >
            Select None
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {labels.map((label, idx) => (
            <div
              key={idx}
              className={`rounded-lg border-2 p-3 transition-colors cursor-pointer ${
                selected.has(idx)
                  ? 'border-brand-terra bg-brand-terra/5'
                  : 'border-brand-warm/40 bg-white'
              }`}
              onClick={() => toggleLabel(idx)}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-brand-dark cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(idx)}
                    onChange={() => toggleLabel(idx)}
                    className="rounded border-brand-warm text-brand-terra focus:ring-brand-terra"
                  />
                  {label.scent || productName}
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadLabel('front', label.scent)
                    }}
                    className="rounded bg-brand-warm/40 px-2 py-0.5 text-[10px] font-medium text-brand-brown hover:bg-brand-warm/70"
                    title="Download front label as PNG"
                  >
                    Front PNG
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadLabel('back', label.scent)
                    }}
                    className="rounded bg-brand-warm/40 px-2 py-0.5 text-[10px] font-medium text-brand-brown hover:bg-brand-warm/70"
                    title="Download back label as PNG"
                  >
                    Back PNG
                  </button>
                </div>
              </div>

              {/* Mini preview */}
              <div className="flex gap-2">
                <div className="border border-brand-warm/60 rounded overflow-hidden flex-shrink-0">
                  <FrontLabel scent={label.scent} productName={productName} />
                </div>
                <div className="border border-brand-warm/60 rounded overflow-hidden flex-shrink-0">
                  <BackLabel ingredients={ingredientList} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actual print output — hidden on screen, shown when printing */}
      <div className="hidden print:block">
        {selectedLabels.flatMap((label, i) =>
          Array.from({ length: copies }).flatMap((_, c) => [
            <div key={`front-${i}-${c}`} className="label-page">
              <FrontLabel scent={label.scent} productName={productName} />
            </div>,
            <div key={`back-${i}-${c}`} className="label-page">
              <BackLabel ingredients={ingredientList} />
            </div>,
          ]),
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          .print\\:block { visibility: visible !important; }
          .print\\:block * { visibility: visible !important; }

          @page {
            size: ${LABEL_W} ${LABEL_H};
            margin: 0;
          }

          .label-page {
            page-break-after: always;
            width: ${LABEL_W};
            height: ${LABEL_H};
            overflow: hidden;
          }
        }
      `}</style>
    </div>
  )
}

/* ── Label components ────────────────────────────────────── */

function FrontLabel({
  scent,
  productName,
}: {
  scent: string
  productName: string
}) {
  return (
    <div
      style={{ width: LABEL_W, height: LABEL_H }}
      className="flex flex-col items-center justify-center text-center px-[2mm] py-[1.5mm] overflow-hidden"
    >
      <span className="text-[9px] font-bold leading-tight tracking-wide uppercase">
        Smelly Mellys
      </span>
      <span className="text-[6.5px] leading-tight text-gray-700">
        240-362-9354
      </span>
      <span className="block h-[2mm]" />
      <span className="text-[8px] font-semibold leading-tight">
        {scent}
      </span>
      <span className="text-[7px] leading-tight text-gray-600 mt-[0.5mm]">
        {productName}
      </span>
    </div>
  )
}

function BackLabel({ ingredients }: { ingredients: string[] }) {
  return (
    <div
      style={{ width: LABEL_W, height: LABEL_H }}
      className="flex flex-col items-center justify-center text-center px-[2mm] py-[1.5mm] overflow-hidden"
    >
      <span className="text-[6px] font-bold leading-tight uppercase tracking-wide mb-[1mm]">
        Ingredients
      </span>
      <span className="text-[5.5px] leading-[1.4] text-gray-700">
        {ingredients.join(', ')}
      </span>
    </div>
  )
}

/* ── Canvas text wrapping helper ─────────────────────────── */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ')
  let line = ''
  let curY = y

  for (const word of words) {
    const test = line + (line ? ' ' : '') + word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY)
      line = word
      curY += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, curY)
}
