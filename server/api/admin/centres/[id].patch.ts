import { eq } from 'drizzle-orm'
import { centres } from '../../../database/schema'

// Changes a centre's name, seats, licence end or whether it is on.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = String(getRouterParam(event, 'id'))
  const body = (await readBody<{ name?: string, seats?: number, licensedUntil?: string, active?: boolean }>(event)) ?? {}
  const set: Partial<typeof centres.$inferInsert> = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 120)
    if (!name) throw createError({ statusCode: 400, message: 'Give the centre a name' })
    set.name = name
  }
  if (body.seats !== undefined) {
    const seats = Math.round(Number(body.seats))
    if (!Number.isFinite(seats) || seats < 0 || seats > 10000) throw createError({ statusCode: 400, message: 'Seats: 0 to 10 000' })
    set.seats = seats
  }
  if (body.licensedUntil !== undefined) {
    const until = new Date(String(body.licensedUntil))
    if (Number.isNaN(until.getTime())) throw createError({ statusCode: 400, message: 'Pick when the licence ends' })
    set.licensedUntil = until
  }
  if (typeof body.active === 'boolean') set.active = body.active
  const [row] = await useDb().update(centres).set(set).where(eq(centres.id, id)).returning()
  if (!row) throw createError({ statusCode: 404, message: 'Centre not found' })
  return row
})
