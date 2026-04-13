'use client'

export type CartItem = {
  variantId: string
  productName: string
  variantName: string
  priceCents: number
  quantity: number
  slug: string
  imageUrl: string | null
}

const CART_KEY = 'sm_cart'

function dispatch() {
  window.dispatchEvent(new CustomEvent('sm:cart-updated'))
}

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CART_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items))
  dispatch()
}

export function addToCart(item: CartItem): void {
  const cart = getCart()
  const existing = cart.find((i) => i.variantId === item.variantId)
  if (existing) {
    existing.quantity += item.quantity
  } else {
    cart.push({ ...item })
  }
  setCart(cart)
}

export function removeFromCart(variantId: string): void {
  setCart(getCart().filter((i) => i.variantId !== variantId))
}

export function updateQuantity(variantId: string, quantity: number): void {
  if (quantity <= 0) {
    removeFromCart(variantId)
    return
  }
  const cart = getCart()
  const item = cart.find((i) => i.variantId === variantId)
  if (item) {
    item.quantity = quantity
    setCart(cart)
  }
}

export function clearCart(): void {
  localStorage.removeItem(CART_KEY)
  dispatch()
}

export function getCartTotal(): number {
  return getCart().reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
}

export function getCartCount(): number {
  return getCart().reduce((sum, i) => sum + i.quantity, 0)
}
