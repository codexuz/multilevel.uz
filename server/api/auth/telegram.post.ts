import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

/**
 * Signing in with Telegram: the page hands over what the Telegram Login Widget returned, and it
 * counts only if Telegram signed it with our bot. A guest is signed in (a new account the first
 * time); someone already signed in has this Telegram linked to their account instead.
 */
export default defineEventHandler(async (event) => {
  if (!telegramBotId()) throw createError({ statusCode: 404, message: 'Telegram sign-in is not set up' })
  const tg = verifyTelegramLogin(await readBody(event))
  if (!tg) throw createError({ statusCode: 401, message: 'Telegram sign-in could not be verified. Please try again.' })

  const db = useDb()
  const telegramId = String(tg.id)
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || null
  const profile = { telegramUsername: tg.username ?? null, updatedAt: new Date() }

  const current = await optionalUser(event)
  if (current) {
    const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.telegramId, telegramId)).limit(1)
    if (owner && owner.id !== current.id) throw createError({ statusCode: 409, message: 'This Telegram account is already used by another account.' })
    const [me] = await db.select().from(users).where(eq(users.id, current.id)).limit(1)
    if (!me) throw createError({ statusCode: 404, message: 'User not found' })
    await db.update(users).set({
      ...profile,
      telegramId,
      name: me.name ?? name,
      avatarUrl: me.avatarUrl ?? tg.photo_url ?? null
    }).where(eq(users.id, me.id))
    return { linked: true, to: '/profile' }
  }

  const [known] = await db.select({ id: users.id }).from(users).where(eq(users.telegramId, telegramId)).limit(1)
  const [row] = await db.insert(users)
    .values({ ...profile, telegramId, name, avatarUrl: tg.photo_url ?? null })
    .onConflictDoUpdate({ target: users.telegramId, set: profile })
    .returning()
  if (!known) await acceptReferral(event, row!.id)
  const signedIn = await signIn(event, row!)
  return { linked: false, to: afterSignIn(event, signedIn) }
})
