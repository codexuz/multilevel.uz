import { eq } from 'drizzle-orm'
import { essays } from '../../../../database/schema'

// Takes a sample essay off the public pages (`{ hidden: false }` puts it back).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody<{ hidden?: boolean }>(event).catch(() => null)) ?? {}
  const [row] = await useDb().update(essays).set({ hiddenAt: body.hidden === false ? null : new Date() })
    .where(eq(essays.id, String(getRouterParam(event, 'id')))).returning({ id: essays.id })
  if (!row) throw createError({ statusCode: 404, message: 'Essay not found' })
  return { hidden: body.hidden !== false }
})
