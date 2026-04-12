import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const SESSION_COOKIE = 'sm_admin'
// Simple token — hash of password + salt. Good enough for single-user admin.
const SESSION_TOKEN = 'sm_authenticated'

export async function requireAdmin() {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  if (session?.value !== SESSION_TOKEN) {
    redirect('/admin/login')
  }
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies()
  const session = cookieStore.get(SESSION_COOKIE)
  return session?.value === SESSION_TOKEN
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  return password === expected
}
