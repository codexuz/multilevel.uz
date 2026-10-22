import { and, eq } from 'drizzle-orm'
import type { centres } from '../database/schema'
import { users } from '../database/schema'

/**
 * The public catalogue of learning centres (/centres) and how a centre asks to join
 * (Apply on /centres). A centre is in the catalogue when it chose to be listed and its licence runs.
 */

type Listing = Pick<typeof centres.$inferInsert, 'city' | 'address' | 'description' | 'phone' | 'telegram' | 'website' | 'logoUrl' | 'listed'>

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** "@name", "t.me/name" or "https://t.me/name" → "name". */
export const telegramHandle = (v: unknown) => {
  const h = text(v, 80)?.replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '').replace(/\/.*$/, '') ?? null
  if (h && !/^\w{3,32}$/.test(h)) throw createError({ statusCode: 400, message: 'The Telegram username is 3–32 letters, digits or _' })
  return h
}

const webAddress = (v: unknown) => {
  const w = text(v, 200)
  if (!w) return null
  const url = /^https?:\/\//i.test(w) ? w : `https://${w}`
  try {
    return new URL(url).protocol.startsWith('http') ? url : null
  } catch {
    throw createError({ statusCode: 400, message: 'The website address is not valid' })
  }
}

/** A centre's public details as its owner or an admin writes them; only the fields given are kept. */
export function listingValues(body: Record<string, unknown>): Partial<Listing> {
  const out: Partial<Listing> = {}
  if (body.city !== undefined) out.city = text(body.city, 80)
  if (body.address !== undefined) out.address = text(body.address, 200)
  if (body.description !== undefined) out.description = text(body.description, 1000)
  if (body.phone !== undefined) out.phone = text(body.phone, 40)
  if (body.telegram !== undefined) out.telegram = telegramHandle(body.telegram)
  if (body.website !== undefined) out.website = webAddress(body.website)
  if (body.logoUrl !== undefined) {
    const logo = text(body.logoUrl, 500)
    // Only pictures from our own storage.
    if (logo && !s3KeyFromUrl(logo)) throw createError({ statusCode: 400, message: 'Upload the logo first' })
    out.logoUrl = logo
  }
  if (typeof body.listed === 'boolean') out.listed = body.listed
  return out
}

export const listingView = (c: typeof centres.$inferSelect) => ({
  city: c.city, address: c.address, description: c.description, phone: c.phone,
  telegram: c.telegram, website: c.website, logoUrl: c.logoUrl, listed: c.listed
})

/** Tells every admin who has the bot about a new request. */
export async function notifyAdminsOfRequest(name: string, city: string | null, students: number | null) {
  const admins = await useDb().select({ id: users.id }).from(users).where(and(eq(users.role, 'admin'), eq(users.banned, false)))
  await Promise.all(admins.map(a => notifyTelegram(a.id, l => ({
    text: MSG.centreRequest(l, name, city, students), path: '/admin/centres', button: MSG.centreRequestButton[l]
  })).catch(() => false)))
}
