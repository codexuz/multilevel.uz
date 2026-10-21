import { eq } from 'drizzle-orm'
import { promoCodes } from '../../../database/schema'

// Switches a promo code on or off, or changes its limit or end date.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody<{ active?: boolean, maxUses?: number | null, endsAt?: string | null }>(event)) ?? {}
  const set: Partial<typeof promoCodes.$inferInsert> = {}
  if (typeof body.active === 'boolean') set.active = body.active
  if ('maxUses' in body) set.maxUses = body.maxUses == null ? null : Math.max(1, Math.round(Number(body.maxUses)))
  if ('endsAt' in body) set.endsAt = body.endsAt ? new Date(body.endsAt) : null
  const [row] = await useDb().update(promoCodes).set(set).where(eq(promoCodes.id, getRouterParam(event, 'id')!)).returning()
  if (!row) throw createError({ statusCode: 404, message: 'Promo code not found' })
  return row
})
