'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

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
 * scent sheet admin page. Edits BOTH new sheet-specific fields:
 *
 *   - iconSheetEmoji (text input, save on blur)
 *   - iconSheetImageUrl (file upload via /api/admin/categories/icon,
 *     then PATCH the URL onto the row)
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
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [emoji, setEmoji] = useState(category.iconSheetEmoji ?? '')
  const [imageUrl, setImageUrl] = useState(category.iconSheetImageUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // The effective icon shown in the preview cell — same priority the
  // public renderer uses.
  const effectiveImage = imageUrl || category.iconImageUrl
  const effectiveEmoji = emoji || category.iconEmoji
  const usingFallback = !imageUrl && !emoji // no sheet-specific icon set

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

  async function upload(file: File) {
    setBusy(true)
    setErr(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/categories/icon', {
        method: 'POST',
        body: fd,
      })
      const json = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null
      if (!res.ok || !json?.url) {
        throw new Error(json?.error ?? `Upload failed (${res.status})`)
      }
      setImageUrl(json.url)
      // Persist immediately so the chip + print page pick it up.
      await patch({ iconSheetImageUrl: json.url })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function commitEmoji() {
    if (emoji === (category.iconSheetEmoji ?? '')) return
    void patch({ iconSheetEmoji: emoji.trim() || null })
  }

  function clearImage() {
    setImageUrl('')
    void patch({ iconSheetImageUrl: null })
  }

  return (
    <div className="grid grid-cols-[40px_1fr_auto_auto_auto] items-center gap-2 px-3 py-2 hover:bg-brand-cream/30">
      {/* Preview — what'll actually render on the sheet */}
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-brand-brown/15 bg-white">
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
      </div>

      {/* Name + status */}
      <div className="min-w-0">
        <div className="truncate text-sm text-brand-dark">{category.name}</div>
        <div className="text-[10px] text-brand-brown/50">
          {usingFallback ? (
            <span title="Using the website icon. Set a sheet-specific one to override.">
              fallback to website icon
            </span>
          ) : (
            <span>sheet icon set</span>
          )}
          {busy && <span className="ml-2 text-brand-terra">saving…</span>}
          {err && <span className="ml-2 text-red-600">{err}</span>}
        </div>
      </div>

      {/* Emoji input */}
      <input
        type="text"
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        onBlur={commitEmoji}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        placeholder="🧔"
        className="w-14 rounded-md border border-brand-brown/20 px-2 py-1 text-center text-base focus:border-brand-terra focus:outline-none"
        title="Emoji for the scent sheet"
      />

      {/* Image upload */}
      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-md border border-brand-brown/20 bg-white px-2 py-1 text-xs hover:border-brand-terra disabled:opacity-50"
          title="Upload a custom icon image (PNG, SVG, etc — under 2 MB)"
        >
          Upload
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={clearImage}
            disabled={busy}
            className="rounded-md border border-brand-brown/20 bg-white px-2 py-1 text-xs text-brand-brown/70 hover:border-red-400 hover:text-red-600 disabled:opacity-50"
            title="Remove the sheet-specific image and fall back"
          >
            ✕
          </button>
        )}
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
