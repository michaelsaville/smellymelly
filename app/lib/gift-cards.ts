/**
 * Gift certificate codes.
 *
 * Format: 10 random Crockford base32 characters + 1 check character = 11.
 * Crockford's alphabet drops I, L, O and U precisely because they get
 * misread or misheard, which matters here — Mel reads these over the phone
 * and types them off a handwritten certificate.
 *
 * 10 chars x 5 bits = ~50 bits of entropy. Codes are stored in plaintext on
 * purpose (see the schema comment); guessing is defended by that entropy
 * plus rate limiting on any public lookup, not by hashing.
 *
 * Printed as SM-XXXX-XXXX-XXX. The "SM" is decoration — it is NOT stored,
 * and normalizeGiftCode() strips it back off on input.
 */

import { randomInt } from 'crypto'

/** Crockford base32: no I, L, O, U. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const RANDOM_LEN = 10
export const CODE_LEN = RANDOM_LEN + 1 // + check character

/**
 * Check character over the 10 random chars, position-weighted so that
 * transposing two adjacent characters (the most common typing slip) fails.
 * Stays inside ALPHABET so the whole code is one character class.
 */
function checkChar(body: string): string {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    sum += (ALPHABET.indexOf(body[i]) + 1) * (i + 1)
  }
  return ALPHABET[sum % ALPHABET.length]
}

/** A fresh code in normalized (stored) form. Not guaranteed unique — the
 *  caller retries against the unique index. */
export function generateGiftCode(): string {
  let body = ''
  for (let i = 0; i < RANDOM_LEN; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)]
  }
  return body + checkChar(body)
}

/**
 * Canonicalize anything a human might type or paste into stored form:
 * strips spaces/hyphens, uppercases, folds the ambiguous letters the way
 * Crockford specifies (I/L -> 1, O -> 0, U -> V), and drops a decorative
 * "SM" prefix. The prefix is only removed when the length says it must be
 * one, so a bare code that happens to start with S,M survives.
 *
 * Returns null if the result isn't a well-formed code.
 */
export function normalizeGiftCode(raw: string): string | null {
  let s = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V')

  if (s.length === CODE_LEN + 2 && s.startsWith('SM')) s = s.slice(2)
  if (s.length !== CODE_LEN) return null
  for (const ch of s) if (!ALPHABET.includes(ch)) return null
  return s
}

/** True if the check character agrees with the body. */
export function isValidGiftCode(code: string): boolean {
  if (code.length !== CODE_LEN) return false
  return checkChar(code.slice(0, RANDOM_LEN)) === code[RANDOM_LEN]
}

/** Normalize AND verify the check character in one step. */
export function parseGiftCode(raw: string): string | null {
  const code = normalizeGiftCode(raw)
  if (!code || !isValidGiftCode(code)) return null
  return code
}

/** Stored code -> the form printed on the certificate: SM-XXXX-XXXX-XXX. */
export function formatGiftCode(code: string): string {
  if (code.length !== CODE_LEN) return code
  return `SM-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`
}

export function giftCardLast4(code: string): string {
  return code.slice(-4)
}
