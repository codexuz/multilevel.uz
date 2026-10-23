import { eq, inArray } from 'drizzle-orm'
import { tests } from '../../../database/schema'

const ACTIONS = ['PUBLISH', 'DRAFT', 'ARCHIVE', 'DELETE', 'FREE', 'PREMIUM'] as const
type Action = (typeof ACTIONS)[number]

/**
 * One action on many tests: publish (each only if it is ready), back to draft, archive, delete (each
 * only if nobody sat it), or make free or Premium. Each test is done on its own; those that cannot be
 * are named with why, and the rest still go through.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody<{ ids?: string[], action?: string }>(event)) ?? {}
  const action = body.action as Action
  if (!ACTIONS.includes(action)) throw createError({ statusCode: 400, message: 'Pick what to do' })
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))].filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200)
  if (!ids.length) throw createError({ statusCode: 400, message: 'Pick the tests' })
  const db = useDb()
  const titles = new Map((await db.select({ id: tests.id, title: tests.title }).from(tests).where(inArray(tests.id, ids))).map(t => [t.id, t.title]))
  let done = 0
  const failed: { id: string, title: string, message: string }[] = []
  for (const id of ids) {
    if (!titles.has(id)) continue
    try {
      if (action === 'PUBLISH') await setStatus(id, 'PUBLISHED')
      else if (action === 'DRAFT') await setStatus(id, 'DRAFT')
      else if (action === 'ARCHIVE') await setStatus(id, 'ARCHIVED')
      else if (action === 'DELETE') await deleteTest(id)
      else await db.update(tests).set({ access: action, updatedAt: new Date() }).where(eq(tests.id, id))
      done++
    } catch (e: any) {
      failed.push({ id, title: titles.get(id)!, message: e?.data?.errors?.[0] ? `${e.message}: ${e.data.errors[0]}` : e?.message || 'Not done' })
    }
  }
  return { done, failed }
})
