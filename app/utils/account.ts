/** How an account is told apart: its email, else its Telegram username. */
export function accountHandle(u?: { email?: string | null, telegramUsername?: string | null, telegram?: boolean } | null): string {
  if (!u) return ''
  if (u.email) return u.email
  if (u.telegramUsername) return `@${u.telegramUsername}`
  return u.telegram ? 'Telegram account' : ''
}

const LAST_SIGN_IN = 'ml.lastSignIn'

/** Remembers on this device which way the user signs in, so the login page can point to it. */
export function rememberSignIn(method: 'google' | 'telegram') {
  try {
    localStorage.setItem(LAST_SIGN_IN, method)
  } catch {
    // Private mode: nothing remembered.
  }
}
export function lastSignIn(): 'google' | 'telegram' | null {
  try {
    const v = localStorage.getItem(LAST_SIGN_IN)
    return v === 'google' || v === 'telegram' ? v : null
  } catch {
    return null
  }
}

/**
 * Adds Google to the signed-in account: through Google's sign-in, which then attaches the email,
 * or offers to merge the account that Google already has.
 */
export function connectGoogle(next = '/profile') {
  document.cookie = 'ml_link=google; path=/; max-age=600; samesite=lax'
  document.cookie = `ml_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`
  rememberSignIn('google')
  window.location.assign('/auth/google')
}
