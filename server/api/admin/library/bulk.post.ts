import { count, eq, inArray } from 'drizzle-orm'
import { parts, sectionItems, speakingParts, writingTasks } from '../../../database/schema'

const KINDS = {
  PART: { table: parts, link: sectionItems.partId, actions: ['OFFER', 'WITHDRAW', 'EXPLAIN', 'DELETE'] },
  WRITING: { table: writingTasks, link: sectionItems.writingTaskId, actions: ['DELETE'] },
  SPEAKING: { table: speakingParts, link: sectionItems.speakingPartId, actions: ['DELETE'] }
} as const
type Kind = keyof typeof KINDS

/** Explaining asks the AI once per part: a few at a time. */
const MAX_EXPLAIN = 20

/**
 * One action on many library items, each done on its own (those that cannot be are named with why):
 * - Listening and Reading parts: offer for practice or stop (OFFER, WITHDRAW), write the AI
 *   explanations their questions lack (EXPLAIN), or DELETE: a part in a test or with answers is
 *   made inactive instead, so no test loses it and results stay true.
 * - Writing tasks and Speaking parts: DELETE, unless in a test or answered (essays, recordings).
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = (await readBody<{ kind?: string, ids?: string[], action?: string }>(event)) ?? {}
  const kind = body.kind as Kind
  if (!(kind in KINDS)) throw createError({ statusCode: 400, message: 'Which kind of item?' })
  const { table, link, actions } = KINDS[kind]
  const action = String(body.action)
  if (!(actions as readonly string[]).includes(action)) throw createError({ statusCode: 400, message: 'Pick what to do' })
  if (action === 'EXPLAIN' && !aiEnabled()) throw createError({ statusCode: 404, message: 'AI is not set up' })
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(String))].filter(id => /^[0-9a-f-]{36}$/i.test(id)).slice(0, action === 'EXPLAIN' ? MAX_EXPLAIN : 200)
  if (!ids.length) throw createError({ statusCode: 400, message: 'Pick the items' })

  const db = useDb()
  const rows = await db.select({ id: table.id, title: table.title }).from(table).where(inArray(table.id, ids))
  const placed = new Map((await db.select({ id: link, n: count() }).from(sectionItems).where(inArray(link, ids)).groupBy(link)).map(r => [r.id, r.n]))
  let done = 0
  const archived: string[] = []
  const failed: { id: string, title: string, message: string }[] = []
  for (const row of rows) {
    const title = row.title || 'Untitled'
    try {
      if (action === 'OFFER' || action === 'WITHDRAW') {
        await db.update(parts).set({ isActive: action === 'OFFER', updatedAt: new Date() }).where(eq(parts.id, row.id))
      } else if (action === 'EXPLAIN') {
        await explainPart(row.id, { userId: admin.id })
      } else if (kind === 'PART') {
        // In a test, or answered: kept and made inactive (deletePart keeps an answered one the same way).
        if (placed.get(row.id)) {
          await db.update(parts).set({ isActive: false, updatedAt: new Date() }).where(eq(parts.id, row.id))
          archived.push(title)
          continue
        }
        const res = await deletePart(row.id)
        if (!res.deleted) {
          archived.push(title)
          continue
        }
      } else {
        const n = placed.get(row.id)
        if (n) throw createError({ statusCode: 409, message: `It is in ${n} test${n === 1 ? '' : 's'}: take it out first` })
        if (kind === 'WRITING') await deleteWritingTask(row.id)
        else await deleteSpeakingPart(row.id)
      }
      done++
    } catch (e: any) {
      failed.push({ id: row.id, title, message: e?.data?.message || e?.statusMessage || e?.message || 'Failed' })
    }
  }
  return { done, archived, failed }
})
