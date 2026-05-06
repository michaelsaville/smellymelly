'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconPicker, type IconValue } from '../../categories/IconPicker'

export interface CategoryIconRow {
  id: string
  name: string
  /** Website icon (existing fields, used as fallback). */
  iconEmoji: string | null
  iconImageUrl: string | null
  /** Scent-sheet specific icon (new fields). */
  iconSheetEmoji: string | null
  iconSheetImageUrl: string | null
}

/**
 * Inline icon picker for a single category, rendered in a row on the
 * scent sheet admin page. Wraps the existing visual IconPicker (used on
 * /admin/categories) so Mel doesn't have to type emoji codes.
 *
 * Display priority on the chip / print page:
 *   sheet image  > sheet emoji  > website image  > website emoji  > "·"
 */
export function CategoryIconPicker({
  category,
}: {
  category: CategoryIconRow
}) {
  const router = useRouter()
  const [picking, setPicking] = useState(false)
  const [emoji, setEmoji] = useState(category.iconSheetEmoji ?? '')
  const [imageUrl, setImageUrl] = useState(category.iconSheetImageUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const effectiveImage = imageUrl || category.iconImageUrl
  const effectiveEmoji = emoji || category.iconEmoji
  const usingFallback = !imageUrl && !emoji

  async function patch(data: Record<string, unknown>) {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: category.id, ...data }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `Save failed (${res.status})`)
      }
      router.refresh()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  // IconPicker speaks the website-icon shape ({ iconEmoji, iconImageUrl }).
  // Map those callbacks onto the sheet-specific fields. Picking either an
  // emoji OR an upload always clears the OTHER sheet field so the priority
  // chain stays a strict winner.
  function applyPick(next: IconValue) {
    setEmoji(next.iconEmoji ?? '')
    setImageUrl(next.iconImageUrl ?? '')
    void patch({
      iconSheetEmoji: next.iconEmoji,
      iconSheetImageUrl: next.iconImageUrl,
    })
  }

  return (
    <div className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-2 hover:bg-brand-cream/30">
      {/* Preview button — click to open the visual picker */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-brand-warm bg-white hover:border-brand-terra"
          title="Click to change the sheet icon for this category"
        >
          {effectiveImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={effectiveImage}
              alt=""
              className="h-7 w-7 object-contain"
            />
          ) : effectiveEmoji ? (
            <span className="text-xl leading-none">{effectiveEmoji}</span>
          ) : (
            <span className="text-brand-brown/30">·</span>
          )}
        </button>
        {picking && (
          <IconPicker
            value={{ iconEmoji: emoji || null, iconImageUrl: imageUrl || null }}
            onChange={applyPick}
            onClose={() => setPicking(false)}
          />
        )}
      </div>

      {/* Name + status */}
      <div className="min-w-0">
        <div className="truncate text-sm text-brand-dark">{category.name}</div>
        <div className="text-[10px] text-brand-brown/50">
          {usingFallback ? (
            <span title="Using the website icon. Click the icon to set a sheet-specific one.">
              fallback to website icon
            </span>
          ) : (
            <span>sheet icon set</span>
          )}
          {busy && <span className="ml-2 text-brand-terra">saving…</span>}
          {err && <span className="ml-2 text-red-600">{err}</span>}
        </div>
      </div>

      {/* Reference: what the website is using */}
      <div className="hidden text-[10px] text-brand-brown/40 sm:block">
        site:{' '}
        {category.iconImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={category.iconImageUrl}
            alt=""
            className="ml-1 inline-block h-4 w-4 object-contain align-middle"
          />
        ) : category.iconEmoji ? (
          <span className="text-sm">{category.iconEmoji}</span>
        ) : (
          <span>—</span>
        )}
      </div>
    </div>
  )
}
