/** Prices and plans as the screens show them. */
export interface Plan {
  id: string
  code: string
  name: string
  description: string | null
  priceUzs: number
  durationDays: number
  credits: number
  featured: boolean
  active: boolean
  position: number
}

export interface Order {
  id: string
  number: number
  planName: string
  amountUzs: number
  durationDays: number
  credits: number
  provider: 'click' | 'manual'
  status: 'PENDING' | 'PAID' | 'CANCELLED'
  note: string | null
  paidAt: string | null
  createdAt: string
  user?: { id: string, name: string, email: string | null, telegramUsername: string | null }
}

/** 79000 → "79 000 so'm". */
export const fmtUzs = (n?: number | null) => (n == null ? '—' : `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${i18nT('common.som', {}, 'so\'m')}`)

/** "30 days", "1 week", "3 months". */
export function durationText(days: number) {
  if (!days) return ''
  if (days % 30 === 0) return i18nTn('duration.months', days / 30, days === 30 ? '1 month' : `${days / 30} months`)
  if (days % 7 === 0) return i18nTn('duration.weeks', days / 7, days === 7 ? '1 week' : `${days / 7} weeks`)
  return i18nTn('duration.days', days, days === 1 ? '1 day' : `${days} days`)
}

export const creditsText = (n: number) => i18nTn('duration.markings', n, n === 1 ? '1 marking' : `${n} markings`)

/** A Telegram chat link with the message to send already written, where Telegram supports it. */
export function telegramLink(base: string, message: string) {
  const url = base.startsWith('http') ? base : `https://t.me/${base.replace(/^@/, '')}`
  return `${url}${url.includes('?') ? '&' : '?'}text=${encodeURIComponent(message)}`
}

export const ORDER_STATUS: Record<Order['status'], { label: string, color: 'warning' | 'success' | 'neutral' }> = {
  PENDING: { label: 'Waiting for payment', color: 'warning' },
  PAID: { label: 'Paid', color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'neutral' }
}
