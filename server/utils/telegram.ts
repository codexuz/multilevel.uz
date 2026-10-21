import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signing in with Telegram (the Telegram Login Widget). Telegram signs what it sends back about the
 * user with the bot's token; https://core.telegram.org/widgets/login#checking-authorization.
 */
export interface TelegramLogin {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number | string
  hash: string
}

/** A login is accepted for a day after Telegram signed it. */
const MAX_AGE_SECONDS = 24 * 60 * 60

export function telegramBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || (useRuntimeConfig().telegramBotToken as string | undefined) || null
}

/** The bot's numeric id, the public part of its token before the colon. */
export function telegramBotId(): string | null {
  const id = telegramBotToken()?.split(':')[0]
  return id && /^\d+$/.test(id) ? id : null
}

/** The login's user if Telegram signed it with our bot recently; otherwise null. */
export function verifyTelegramLogin(data: Partial<TelegramLogin>, now = Date.now()): TelegramLogin | null {
  const token = telegramBotToken()
  if (!token || !data || typeof data.hash !== 'string' || !data.id || !data.auth_date) return null

  const check = Object.entries(data)
    .filter(([k, v]) => k !== 'hash' && v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n')
  const secret = createHash('sha256').update(token).digest()
  const expected = createHmac('sha256', secret).update(check).digest()
  const given = Buffer.from(data.hash, 'hex')
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  const age = now / 1000 - Number(data.auth_date)
  if (!(age < MAX_AGE_SECONDS) || age < -300) return null
  return data as TelegramLogin
}

/** Calls the Bot API (TELEGRAM_API_URL points it elsewhere, e.g. a local Bot API server). */
export async function telegramApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<{ ok: boolean, result?: T, description?: string }> {
  const token = telegramBotToken()
  if (!token) return { ok: false, description: 'No bot token' }
  const base = (process.env.TELEGRAM_API_URL || 'https://api.telegram.org').replace(/\/$/, '')
  return $fetch<{ ok: boolean, result?: T, description?: string }>(`${base}/bot${token}/${method}`, { method: 'POST', body, timeout: 8000 })
}
