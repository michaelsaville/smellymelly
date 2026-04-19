'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Square Web Payments SDK types (loaded via script tag)
interface SquarePayments {
  card(): Promise<SquareCard>
}
interface SquareCard {
  attach(selector: string): Promise<void>
  tokenize(): Promise<{ status: string; token?: string; errors?: Array<{ message: string }> }>
  destroy(): Promise<void>
}
interface SquareSDK {
  payments(appId: string, locationId: string): Promise<SquarePayments>
}

declare global {
  interface Window {
    Square?: SquareSDK
  }
}

interface Props {
  onTokenize: (token: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

export default function SquarePaymentForm({ onTokenize, onError, disabled }: Props) {
  const [loading, setLoading] = useState(true)
  const [cardReady, setCardReady] = useState(false)
  const [squareConfig, setSquareConfig] = useState<{
    configured: boolean
    appId?: string
    locationId?: string
    environment?: string
  } | null>(null)
  const cardRef = useRef<SquareCard | null>(null)
  const initRef = useRef(false)

  // Load Square config from our API
  useEffect(() => {
    fetch('/api/square/config')
      .then((r) => r.json())
      .then(setSquareConfig)
      .catch(() => setSquareConfig({ configured: false }))
  }, [])

  // Load Square Web Payments SDK script
  useEffect(() => {
    if (!squareConfig?.configured) return

    const sdkUrl = squareConfig.environment === 'production'
      ? 'https://web.squarecdn.com/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js'

    // Don't add the script twice
    if (document.querySelector(`script[src="${sdkUrl}"]`)) {
      return
    }

    const script = document.createElement('script')
    script.src = sdkUrl
    script.async = true
    document.head.appendChild(script)
  }, [squareConfig])

  // Initialize the card form once SDK is loaded
  const initCard = useCallback(async () => {
    if (initRef.current || !squareConfig?.configured || !squareConfig.appId || !squareConfig.locationId) return
    if (!window.Square) return

    initRef.current = true
    try {
      const payments = await window.Square.payments(squareConfig.appId, squareConfig.locationId)
      const card = await payments.card()
      await card.attach('#square-card-container')
      cardRef.current = card
      setCardReady(true)
      setLoading(false)
    } catch (err) {
      console.error('Square card init error:', err)
      onError('Failed to load payment form. Please refresh and try again.')
      setLoading(false)
    }
  }, [squareConfig, onError])

  // Poll for Square SDK readiness
  useEffect(() => {
    if (!squareConfig?.configured) {
      setLoading(false)
      return
    }

    const interval = setInterval(() => {
      if (window.Square) {
        clearInterval(interval)
        initCard()
      }
    }, 200)

    // Timeout after 15 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (!cardRef.current) {
        setLoading(false)
        onError('Payment form timed out. Please refresh and try again.')
      }
    }, 15000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [squareConfig, initCard, onError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => {})
      }
    }
  }, [])

  // Called by parent to tokenize
  const tokenize = useCallback(async () => {
    if (!cardRef.current) {
      onError('Payment form not ready.')
      return
    }

    const result = await cardRef.current.tokenize()
    if (result.status === 'OK' && result.token) {
      onTokenize(result.token)
    } else {
      const msg = result.errors?.map((e) => e.message).join(', ') || 'Card verification failed.'
      onError(msg)
    }
  }, [onTokenize, onError])

  // Expose tokenize to parent via ref pattern (we'll use a callback approach instead)
  // Parent will call tokenize through a ref
  useEffect(() => {
    // Store tokenize on the container element so parent can invoke it
    const el = document.getElementById('square-card-container')
    if (el) {
      (el as HTMLElement & { tokenize?: () => Promise<void> }).tokenize = tokenize
    }
  }, [tokenize])

  if (squareConfig && !squareConfig.configured) {
    return (
      <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown">
        Square payment integration coming soon. Your order will be placed as pending and we will reach out with payment instructions.
      </div>
    )
  }

  return (
    <div>
      {loading && (
        <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown animate-pulse">
          Loading payment form...
        </div>
      )}
      <div
        id="square-card-container"
        className={`min-h-[44px] ${loading ? 'hidden' : ''} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      />
      {cardReady && (
        <p className="mt-2 text-xs text-brand-brown/50">
          Payments are processed securely by Square.
        </p>
      )}
    </div>
  )
}
