import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

interface GoogleUser { email: string, name?: string, picture?: string, sub?: string }

export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  async onSuccess(event, { user }) {
    const g = user as GoogleUser
    if (!g.email) throw createError({ statusCode: 400, message: 'Google account has no email' })

    const db = useDb()

    // "Connect Google" from Profile: add this Google to the signed-in account, or offer to merge
    // the account this Google already has.
    const linking = getCookie(event, 'ml_link') === 'google'
    deleteCookie(event, 'ml_link', { path: '/' })
    const current = linking ? await optionalUser(event) : null
    if (current) {
      const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, g.email)).limit(1)
      if (owner && owner.id !== current.id) return sendRedirect(event, `/account/merge?token=${mergeToken(current.id, owner.id)}`)
      if (!owner) {
        const [me] = await db.select().from(users).where(eq(users.id, current.id)).limit(1)
        if (me?.email) return sendRedirect(event, '/profile?google=other')
        await db.update(users).set({ email: g.email, name: me?.name ?? g.name ?? null, avatarUrl: me?.avatarUrl ?? g.picture ?? null, updatedAt: new Date() }).where(eq(users.id, current.id))
      }
      return sendRedirect(event, '/profile?google=connected')
    }

    // Upsert user by email
    let [row] = await db.select().from(users).where(eq(users.email, g.email)).limit(1)
    if (!row) {
      [row] = await db.insert(users).values({
        email: g.email,
        name: g.name ?? null,
        avatarUrl: g.picture ?? null
      }).returning()
      await acceptReferral(event, row!.id)
    } else if ((g.name && g.name !== row.name) || (g.picture && g.picture !== row.avatarUrl)) {
      [row] = await db.update(users)
        .set({ name: g.name ?? row.name, avatarUrl: g.picture ?? row.avatarUrl, updatedAt: new Date() })
        .where(eq(users.id, row.id)).returning()
    }

    const signedIn = await signIn(event, row!)
    return sendRedirect(event, afterSignIn(event, signedIn))
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/login?error=oauth')
  }
})
