import { and, eq, or } from 'drizzle-orm'
import { centreMembers, centreRequests, centres, users } from '../../../database/schema'

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
// With `requestId`, from a centre's request to join: its sender is the owner, its contacts carry over,
// and they are told on Telegram.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<{ name?: string, owner?: string, seats?: number, licensedUntil?: string, requestId?: string }>(event)) ?? {}
  const name = String(body.name ?? '').trim().slice(0, 120)
  const seats = Math.round(Number(body.seats))
  const until = new Date(String(body.licensedUntil))
  if (!name) throw createError({ statusCode: 400, message: 'Give the centre a name' })
  if (!Number.isFinite(seats) || seats < 1 || seats > 10000) throw createError({ statusCode: 400, message: 'Seats: 1 to 10 000' })
  if (Number.isNaN(until.getTime()) || until <= new Date()) throw createError({ statusCode: 400, message: 'Pick when the licence ends' })
  const db = useDb()
  const [request] = body.requestId
    ? await db.select().from(centreRequests).where(and(eq(centreRequests.id, String(body.requestId)), eq(centreRequests.status, 'PENDING'))).limit(1)
    : []
  if (body.requestId && !request) throw createError({ statusCode: 404, message: 'That request was already answered' })
  const owner = request ? { id: request.userId } : await findUser(String(body.owner ?? ''))
  if (!owner) throw createError({ statusCode: 400, message: 'No user with that email or @username. They need to sign in once first.' })
  const centre = await db.transaction(async (tx) => {
    const [c] = await tx.insert(centres).values({
      name, seats, licensedUntil: until, teacherCode: newCode(), createdById: admin.id,
      ...(request ? { city: request.city, phone: request.phone, telegram: request.telegram } : {})
    }).returning()
    await tx.insert(centreMembers).values({ centreId: c!.id, userId: owner.id, role: 'OWNER' })
    await raiseRole(tx, owner.id, 'center_owner')
    if (request) {
      await tx.update(centreRequests).set({ status: 'APPROVED', centreId: c!.id, reviewedById: admin.id, reviewedAt: new Date() })
        .where(eq(centreRequests.id, request.id))
    }
    return c!
  })
  if (request) await notifyTelegram(owner.id, l => ({ text: MSG.centreApproved(l, centre.name), path: '/centre', button: MSG.centreApprovedButton[l] })).catch(() => false)
  return centre
})
