import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

interface GoogleUser { email: string, name?: string, picture?: string, sub?: string }

export default defineOAuthGoogleEventHandler({
  config: { scope: ['email', 'profile'] },
  async onSuccess(event, { user }) {
    const g = user as GoogleUser
    if (!g.email) throw createError({ statusCode: 400, message: 'Google account has no email' })

    const db = useDb()

    // Upsert user by email
    let [row] = await db.select().from(users).where(eq(users.email, g.email)).limit(1)
    if (!row) {
      [row] = await db.insert(users).values({
        email: g.email,
        name: g.name ?? null,
        avatarUrl: g.picture ?? null
      }).returning()
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
