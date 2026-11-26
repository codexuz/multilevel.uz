import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

interface GoogleUser { email: string, name?: string, picture?: string, sub?: string }

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  if (query.error) {
    return sendRedirect(event, '/login?error=oauth')
  }

  const site = String(useRuntimeConfig(event).public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  const handler = defineOAuthGoogleEventHandler({
    config: {
      scope: ['email', 'profile'],
      redirectURL: `${site}/auth/google`
    },
    async onSuccess(ev, { user }) {
      const g = user as GoogleUser
      if (!g.email) throw createError({ statusCode: 400, message: 'Google account has no email' })

      const db = useDb()

      // "Connect Google" from Profile: add this Google to the signed-in account, or offer to merge
      // the account this Google already has.
      const linking = getCookie(ev, 'ml_link') === 'google'
      deleteCookie(ev, 'ml_link', { path: '/' })
      const current = linking ? await optionalUser(ev) : null
      if (current) {
        const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, g.email)).limit(1)
        if (owner && owner.id !== current.id) return sendRedirect(ev, `/account/merge?token=${mergeToken(current.id, owner.id)}`)
        if (!owner) {
          const [me] = await db.select().from(users).where(eq(users.id, current.id)).limit(1)
          if (me?.email) return sendRedirect(ev, '/profile?google=other')
          await db.update(users).set({ email: g.email, name: me?.name ?? g.name ?? null, avatarUrl: me?.avatarUrl ?? g.picture ?? null, updatedAt: new Date() }).where(eq(users.id, current.id))
        }
        return sendRedirect(ev, '/profile?google=connected')
      }

      // Upsert user by email
      let [row] = await db.select().from(users).where(eq(users.email, g.email)).limit(1)
      if (!row) {
        [row] = await db.insert(users).values({
          email: g.email,
          name: g.name ?? null,
          avatarUrl: g.picture ?? null
        }).returning()
        await acceptReferral(ev, row!.id)
      } else if ((g.name && g.name !== row.name) || (g.picture && g.picture !== row.avatarUrl)) {
        [row] = await db.update(users)
          .set({ name: g.name ?? row.name, avatarUrl: g.picture ?? row.avatarUrl, updatedAt: new Date() })
          .where(eq(users.id, row.id)).returning()
      }

      const signedIn = await signIn(ev, row!)
      return sendRedirect(ev, afterSignIn(ev, signedIn))
    },
    onError(ev, error) {
      console.error('[auth/google] OAuth error:', error)
      return sendRedirect(ev, '/login?error=oauth')
    }
  })

  try {
    return await handler(event)
  } catch (e: any) {
    // nuxt-auth-utils only catches HTTP 401 from the token endpoint, so Google's HTTP 400
    // `invalid_grant` (e.g. reused/expired code, duplicate callback request, or redirect_uri mismatch)
    // throws here instead of calling onError.
    const oauthErr = e?.data?.error || e?.cause?.data?.error
    console.warn('[auth/google] token exchange failed:', oauthErr || e?.message || e)
    // If a duplicate callback hit after the first already signed the user in, continue smoothly.
    const existing = await optionalUser(event)
    if (existing) {
      const [row] = await useDb().select().from(users).where(eq(users.id, existing.id)).limit(1)
      if (row) return sendRedirect(event, afterSignIn(event, row))
    }
    return sendRedirect(event, '/login?error=oauth')
  }
})
