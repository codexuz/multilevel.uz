import { eq, or } from 'drizzle-orm'
import { centreMembers, centres, users } from '../../../database/schema'

/** Finds a user by email, @username or id. */
async function findUser(who: string) {
  const w = who.trim()
  const handle = w.replace(/^@/, '')
  const [u] = await useDb().select({ id: users.id }).from(users).where(or(
    eq(users.email, w.toLowerCase()), eq(users.telegramUsername, handle),
    /^[0-9a-f-]{36}$/i.test(w) ? eq(users.id, w) : undefined
  )).limit(1)
  return u ?? null
}

// Opens a learning centre: a name, seats, how long the licence runs, and its owner (who has signed in once).
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<{ name?: string, owner?: string, seats?: number, licensedUntil?: string }>(event)) ?? {}
  const name = String(body.name ?? '').trim().slice(0, 120)
  const seats = Math.round(Number(body.seats))
  const until = new Date(String(body.licensedUntil))
  if (!name) throw createError({ statusCode: 400, message: 'Give the centre a name' })
  if (!Number.isFinite(seats) || seats < 1 || seats > 10000) throw createError({ statusCode: 400, message: 'Seats: 1 to 10 000' })
  if (Number.isNaN(until.getTime()) || until <= new Date()) throw createError({ statusCode: 400, message: 'Pick when the licence ends' })
  const owner = await findUser(String(body.owner ?? ''))
  if (!owner) throw createError({ statusCode: 400, message: 'No user with that email or @username. They need to sign in once first.' })
  const db = useDb()
  return db.transaction(async (tx) => {
    const [c] = await tx.insert(centres).values({ name, seats, licensedUntil: until, teacherCode: newCode(), createdById: admin.id }).returning()
    await tx.insert(centreMembers).values({ centreId: c!.id, userId: owner.id, role: 'OWNER' })
    return c
  })
})
