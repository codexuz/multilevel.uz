import { eq } from 'drizzle-orm'
import { attempts, users } from '../../../database/schema'

// The owner shares a scored result: the page link (with the picture as its preview) and the
// picture itself. The link is signed, so only results shared this way can be opened by others.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const [attempt] = await useDb().select({ userId: attempts.userId }).from(attempts).where(eq(attempts.id, id)).limit(1)
  const [{ locale } = { locale: null }] = await useDb().select({ locale: users.locale }).from(users).where(eq(users.id, user.id)).limit(1)
  if (!attempt || attempt.userId !== user.id) throw createError({ statusCode: 404, message: 'Result not found' })
  const data = await shareData(id)
  if (!data) throw createError({ statusCode: 409, message: 'This result has no score to share yet' })
  const site = String(useRuntimeConfig().public.siteUrl || getRequestURL(event).origin).replace(/\/$/, '')
  const token = shareToken(id)
  return {
    url: `${site}/share/${token}`,
    image: `${site}/og/${token}.png`,
    text: MSG.shareText(asLocale(locale), data.skill, data.score, data.cefrLevel)
  }
})
