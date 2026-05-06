'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EMOJI_LIBRARY,
  searchEmoji,
  type EmojiEntry,
} from '@/app/lib/emoji-library'

type Mode = 'emoji' | 'upload'

export type IconValue = {
  iconEmoji: string | null
  iconImageUrl: string | null
}

export function IconPicker({
  value,
  onChange,
  onClose,
}: {
  value: IconValue
  onChange: (next: IconValue) => void
  onClose: () => void
}) {
  // Default to whichever side currently has a value, else emoji.
  const initialMode: Mode = value.iconImageUrl ? 'upload' : 'emoji'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Click-outside + Esc to close.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const filtered = useMemo(() => searchEmoji(search), [search])

  function pickEmoji(e: EmojiEntry) {
    onChange({ iconEmoji: e.char, iconImageUrl: null })
    onClose()
  }

  function clearIcon() {
    onChange({ iconEmoji: null, iconImageUrl: null })
    onClose()
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/categories/icon', {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      onChange({ iconEmoji: null, iconImageUrl: json.url })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-brand-warm bg-white p-3 shadow-lg"
      role="dialog"
    >
      {/* Tab strip */}
      <div className="mb-2 flex items-center gap-1 border-b border-brand-warm/40 pb-2">
        <button
          onClick={() => setMode('emoji')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            mode === 'emoji'
              ? 'bg-brand-warm text-brand-dark'
              : 'text-brand-brown/60 hover:bg-brand-warm/40'
          }`}
        >
          Emoji
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`rounded-md px-2.5 py-1 text-xs font-medium ${
            mode === 'upload'
              ? 'bg-brand-warm text-brand-dark'
              : 'text-brand-brown/60 hover:bg-brand-warm/40'
          }`}
        >
          Upload image
        </button>
        <button
          onClick={clearIcon}
          className="ml-auto text-[10px] text-brand-brown/50 hover:text-red-500"
          title="Remove icon"
        >
          Clear
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {mode === 'emoji' ? (
        <div>
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bath, candle, lip…"
            className="input mb-2 text-sm"
          />
          <div className="max-h-72 overflow-y-auto pr-1">
            {search ? (
              filtered.length === 0 ? (
                <p className="px-1 py-3 text-center text-xs text-brand-brown/50">
                  No matches. Try &ldquo;flower&rdquo;, &ldquo;fruit&rdquo;,
                  &ldquo;heart&rdquo;…
                </p>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {filtered.map((e) => (
                    <EmojiButton key={e.char} entry={e} onPick={pickEmoji} />
                  ))}
                </div>
              )
            ) : (
              EMOJI_LIBRARY.map((g) => (
                <div key={g.group} className="mb-2">
                  <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-brand-brown/40">
                    {g.group}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {g.emoji.map((e) => (
                      <EmojiButton key={e.char} entry={e} onPick={pickEmoji} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-brand-brown/60">
            PNG, JPEG, WebP, SVG, or GIF — under 2 MB.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
            onChange={handleUpload}
            disabled={uploading}
            className="block w-full text-xs text-brand-brown file:mr-2 file:rounded-md file:border-0 file:bg-brand-warm file:px-2 file:py-1 file:text-xs file:font-medium file:text-brand-dark hover:file:bg-brand-warm/80"
          />
          {uploading && (
            <p className="text-xs text-brand-brown/50">Uploading…</p>
          )}
          {value.iconImageUrl && (
            <div className="mt-2 flex items-center gap-2 border-t border-brand-warm/40 pt-2">
              <span className="text-[11px] text-brand-brown/60">
                Currently:
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value.iconImageUrl}
                alt="Current icon"
                className="h-8 w-8 rounded object-cover"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmojiButton({
  entry,
  onPick,
}: {
  entry: EmojiEntry
  onPick: (e: EmojiEntry) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(entry)}
      title={entry.name}
      className="flex h-8 w-8 items-center justify-center rounded-md text-xl hover:bg-brand-warm/60"
    >
      {entry.char}
    </button>
  )
}
