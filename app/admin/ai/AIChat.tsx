'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  text: string
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  // Conversation history for the API (includes tool_use blocks)
  const [apiMessages, setApiMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', text }])

    const newApiMessages = [
      ...apiMessages,
      { role: 'user', content: text },
    ]

    setLoading(true)

    try {
      const res = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newApiMessages }),
      })

      const json = await res.json()

      if (json.error) {
        setError(json.error)
        // Remove the user message from API history since it failed
        setMessages((prev) => prev.slice(0, -1))
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: json.reply },
        ])
        // Update API messages with the full conversation including tool calls
        setApiMessages(json.messages || newApiMessages)
      }
    } catch {
      setError('Failed to reach the AI. Check your connection.')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-brand-warm/60 bg-white p-4 space-y-4 mb-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">&#x1f9f4;</div>
            <p className="text-brand-brown/50 text-sm max-w-md">
              Hey! I&apos;m your AI assistant. Tell me what you need — like
              &quot;add 12 lip balms lavender scent at $4.50&quot; or &quot;what&apos;s
              low on stock?&quot; and I&apos;ll handle it.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                'Add 12 Lip Balms, Lavender scent, $4.50 each',
                "What's low on stock?",
                'Show me all my products',
                'Write descriptions for all my products',
                'Add a new material: Shea Butter, 16oz for $12.99 from Amazon',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="rounded-full border border-brand-warm px-3 py-1.5 text-xs text-brand-brown/70 hover:bg-brand-warm/50 hover:text-brand-dark transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-brand-terra text-white rounded-br-sm'
                  : 'bg-surface-muted text-brand-dark border border-brand-warm/40 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-muted border border-brand-warm/40 rounded-xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-brown/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-brand-brown/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-brand-brown/30 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me what you need..."
          rows={1}
          className="input flex-1 resize-none py-3"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="btn-primary px-6 disabled:opacity-50 self-end"
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
