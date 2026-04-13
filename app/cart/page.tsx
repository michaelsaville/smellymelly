'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import StoreLayout from '@/app/components/StoreLayout'
import { getCart, updateQuantity, removeFromCart, type CartItem } from '@/app/lib/cart'

const TAX_RATE = 0.06

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)

  const refresh = useCallback(() => {
    setItems(getCart())
  }, [])

  useEffect(() => {
    setMounted(true)
    refresh()
    window.addEventListener('sm:cart-updated', refresh)
    return () => window.removeEventListener('sm:cart-updated', refresh)
  }, [refresh])

  if (!mounted) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="font-display text-3xl font-bold text-brand-dark">Your Cart</h1>
          <p className="mt-6 text-brand-brown/60">Loading...</p>
        </div>
      </StoreLayout>
    )
  }

  const subtotal = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
  const tax = Math.round(subtotal * TAX_RATE)
  const total = subtotal + tax

  if (items.length === 0) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h1 className="font-display text-3xl font-bold text-brand-dark">Your Cart</h1>
          <p className="mt-6 text-brand-brown/60 text-lg">Your cart is empty</p>
          <Link href="/shop" className="btn-primary mt-8 inline-block">
            Continue Shopping
          </Link>
        </div>
      </StoreLayout>
    )
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-display text-3xl font-bold text-brand-dark">Your Cart</h1>

        <div className="mt-8 grid gap-10 lg:grid-cols-3">
          {/* Cart items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div key={item.variantId} className="card flex gap-4 items-start">
                {/* Thumbnail */}
                <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-surface-muted overflow-hidden">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.productName}
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-brand-brown/30 text-2xl">
                      ?
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/shop/${item.slug}`}
                    className="font-display font-semibold text-brand-dark hover:text-brand-terra transition-colors"
                  >
                    {item.productName}
                  </Link>
                  <p className="text-sm text-brand-brown/60">{item.variantName}</p>
                  <p className="mt-1 text-sm font-medium text-brand-terra">
                    {formatMoney(item.priceCents)}
                  </p>
                </div>

                {/* Quantity controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                    className="h-8 w-8 rounded-lg border border-brand-warm text-brand-brown hover:bg-brand-warm transition-colors flex items-center justify-center"
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-medium text-brand-dark">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                    className="h-8 w-8 rounded-lg border border-brand-warm text-brand-brown hover:bg-brand-warm transition-colors flex items-center justify-center"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div className="text-right w-20 flex-shrink-0">
                  <p className="font-medium text-brand-dark">
                    {formatMoney(item.priceCents * item.quantity)}
                  </p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeFromCart(item.variantId)}
                  className="text-brand-brown/40 hover:text-red-500 transition-colors p-1"
                  aria-label="Remove item"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <Link
              href="/shop"
              className="inline-block text-sm font-medium text-brand-terra hover:text-brand-brown transition-colors mt-2"
            >
              &larr; Continue Shopping
            </Link>
          </div>

          {/* Summary sidebar */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24">
              <h2 className="font-display text-xl font-bold text-brand-dark mb-4">
                Order Summary
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-brand-brown">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between text-brand-brown/60">
                  <span>Estimated Tax (6%)</span>
                  <span>{formatMoney(tax)}</span>
                </div>
                <div className="border-t border-brand-warm/40 pt-2 flex justify-between font-semibold text-brand-dark text-base">
                  <span>Estimated Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>
              <Link
                href="/checkout"
                className="btn-primary w-full mt-6 text-center"
              >
                Proceed to Checkout
              </Link>
            </div>
          </div>
        </div>
      </div>
    </StoreLayout>
  )
}
