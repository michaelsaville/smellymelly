'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// Local typings for the Cash App Pay slice of the Square Web Payments SDK.
// The global window.Square is declared by SquarePaymentForm — we just cast
// through it here to avoid duplicating the module augmentation.
interface SquareTokenResult {
  status: string
  token?: string
  errors?: Array<{ message: string }>
}
interface SquareCashAppPayInstance {
  attach(selector: string): Promise<void>
  destroy(): Promise<void>
  addEventListener(
    event: 'ontokenization',
    handler: (e: { detail: { tokenResult: SquareTokenResult } }) => void,
  ): void
}

interface Props {
  amountCents: number
  referenceId: string
  onTokenize: (token: string) => void
  onError: (message: string) => void
  disabled?: boolean
}

// Cash App Pay renders as a Square-provided button. Clicking it opens Cash
// App (mobile deep-link or QR code on desktop), and when the customer
// approves the charge, Square fires an `ontokenization` event with a source
// token. We hand that token up to the checkout form the same way the card
// form does.
export default function SquareCashAppPay({
  amountCents,
  referenceId,
  onTokenize,
  onError,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [config, setConfig] = useState<{
    configured: boolean
    appId?: string
    locationId?: string
    environment?: string
  } | null>(null)
  const cashAppRef = useRef<SquareCashAppPayInstance | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    fetch('/api/square/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ configured: false }))
  }, [])

  useEffect(() => {
    if (!config?.configured) return
    const sdkUrl =
      config.environment === 'production'
        ? 'https://web.squarecdn.com/v1/square.js'
        : 'https://sandbox.web.squarecdn.com/v1/square.js'
    if (document.querySelector(`script[src="${sdkUrl}"]`)) return
    const script = document.createElement('script')
    script.src = sdkUrl
    script.async = true
    document.head.appendChild(script)
  }, [config])

  const init = useCallback(async () => {
    if (
      initRef.current ||
      !config?.configured ||
      !config.appId ||
      !config.locationId
    ) {
      return
    }
    if (!window.Square) return

    initRef.current = true
    try {
      // Square SDK surface beyond .card() is not covered by our local
      // typings, so cast through unknown to reach paymentRequest + cashAppPay.
      const payments = (await (
        window.Square as unknown as {
          payments: (appId: string, locationId: string) => Promise<unknown>
        }
      ).payments(config.appId, config.locationId)) as {
        paymentRequest: (req: unknown) => unknown
        cashAppPay: (
          req: unknown,
          opts: { redirectURL: string; referenceId: string },
        ) => Promise<SquareCashAppPayInstance>
      }

      const paymentRequest = payments.paymentRequest({
        countryCode: 'US',
        currencyCode: 'USD',
        total: {
          amount: (amountCents / 100).toFixed(2),
          label: 'Total',
        },
      })
      const cashAppPay = await payments.cashAppPay(paymentRequest, {
        redirectURL: window.location.href,
        referenceId,
      })
      cashAppPay.addEventListener('ontokenization', (event) => {
        const { tokenResult } = event.detail
        if (tokenResult.status === 'OK' && tokenResult.token) {
          onTokenize(tokenResult.token)
        } else {
          onError(
            tokenResult.errors?.map((e) => e.message).join(', ') ||
              'Cash App payment failed.',
          )
        }
      })
      await cashAppPay.attach('#cash-app-pay-container')
      cashAppRef.current = cashAppPay
      setReady(true)
      setLoading(false)
    } catch (err) {
      console.error('Cash App Pay init error:', err)
      onError('Failed to load Cash App Pay. Please try another payment method.')
      setLoading(false)
    }
  }, [config, amountCents, referenceId, onTokenize, onError])

  useEffect(() => {
    if (!config?.configured) {
      setLoading(false)
      return
    }
    const interval = setInterval(() => {
      if (window.Square) {
        clearInterval(interval)
        init()
      }
    }, 200)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (!cashAppRef.current) {
        setLoading(false)
        onError('Cash App Pay timed out. Please refresh and try again.')
      }
    }, 15000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [config, init, onError])

  useEffect(() => {
    return () => {
      if (cashAppRef.current) {
        cashAppRef.current.destroy().catch(() => {})
      }
    }
  }, [])

  if (config && !config.configured) {
    return (
      <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown">
        Cash App Pay isn&apos;t available yet. Please pick a different payment
        method.
      </div>
    )
  }

  return (
    <div>
      {loading && (
        <div className="rounded-lg bg-surface-warm px-4 py-3 text-sm text-brand-brown animate-pulse">
          Loading Cash App Pay…
        </div>
      )}
      <div
        id="cash-app-pay-container"
        className={`min-h-[44px] ${loading ? 'hidden' : ''} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      />
      {ready && (
        <p className="mt-2 text-xs text-brand-brown/50">
          You&apos;ll be redirected to Cash App to approve the charge.
        </p>
      )}
    </div>
  )
}
