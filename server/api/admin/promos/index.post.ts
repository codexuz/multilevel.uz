import { promoCodes } from '../../../database/schema'

// A new promo code.
interface Body { code?: string, kind?: string, value?: number, planCodes?: string[], maxUses?: number | null, endsAt?: string | null, note?: string | null }

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<Body>(event)) ?? {}
  const code = normalizeCode(body.code)
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw createError({ statusCode: 400, message: 'The code is 3–32 letters, digits, - or _' })
  if (!['PERCENT', 'AMOUNT', 'DAYS'].includes(String(body.kind))) throw createError({ statusCode: 400, message: 'Choose what the code gives' })
  const value = Math.round(Number(body.value))
  if (!Number.isFinite(value) || value < 1 || (body.kind === 'PERCENT' && value > 100) || (body.kind === 'DAYS' && value > 366)) {
    throw createError({ statusCode: 400, message: body.kind === 'PERCENT' ? 'Percent off is 1–100' : body.kind === 'DAYS' ? 'Days are 1–366' : 'The amount must be positive' })
  }
  const maxUses = body.maxUses == null || body.maxUses === ('' as any) ? null : Math.max(1, Math.round(Number(body.maxUses)))
  const endsAt = body.endsAt ? new Date(body.endsAt) : null
  if (endsAt && Number.isNaN(endsAt.getTime())) throw createError({ statusCode: 400, message: 'The end date is not valid' })
  const [row] = await useDb().insert(promoCodes).values({
    code, kind: String(body.kind), value, planCodes: Array.isArray(body.planCodes) ? body.planCodes.map(String) : [],
    maxUses, endsAt, note: body.note?.trim() || null, createdById: admin.id
  }).onConflictDoNothing().returning()
  if (!row) throw createError({ statusCode: 409, message: 'This code already exists' })
  return row
})
