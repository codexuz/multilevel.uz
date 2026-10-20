/** How an account is told apart: its email, else its Telegram username. */
export function accountHandle(u?: { email?: string | null, telegramUsername?: string | null, telegram?: boolean } | null): string {
  if (!u) return ''
  if (u.email) return u.email
  if (u.telegramUsername) return `@${u.telegramUsername}`
  return u.telegram ? 'Telegram account' : ''
}
