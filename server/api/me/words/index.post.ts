import { and, eq, gt, sql } from 'drizzle-orm'
import { parts, userWords, users } from '../../../database/schema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Saves a word or short phrase I picked out of a text to My Words, with the sentence it came from,
 * and what it means (from the shared cache, else written by the AI). Saving one I have already
 * saved gives it back as it is.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<{ word?: unknown, sentence?: unknown, partId?: unknown, locale?: unknown }>(event)
  const word = String(body?.word ?? '').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  const term = normaliseTerm(word)
  const problem = termProblem(term)
  if (problem) throw createError({ statusCode: 400, message: problem })
  // A paragraph's letter ("A Most people assume…") is not part of its first sentence.
  const sentence = String(body?.sentence ?? '').replace(/\s+/g, ' ').trim().replace(/^[A-H]\s+(?=[A-Z])/, '').slice(0, 400) || null

  const db = useDb()
  let partId: string | null = typeof body?.partId === 'string' && UUID.test(body.partId) ? body.partId : null
  if (partId) {
    const [part] = await db.select({ id: parts.id }).from(parts).where(eq(parts.id, partId)).limit(1)
    if (!part) partId = null
  }

  let locale = body?.locale
  if (!isWordLocale(locale)) {
    const [me] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, user.id)).limit(1)
    locale = isWordLocale(me?.locale) ? me.locale : 'en'
  }

  const [existing] = await db.select().from(userWords).where(and(eq(userWords.userId, user.id), eq(userWords.term, term))).limit(1)
  if (existing) return { word: wordView(await defineSavedWord(existing, locale as WordLocale)), created: false }

  const [today] = await db.select({ n: sql<number>`count(*)::int` }).from(userWords)
    .where(and(eq(userWords.userId, user.id), gt(userWords.createdAt, new Date(Date.now() - 86_400_000))))
  if ((today?.n ?? 0) >= DAILY_LIMIT) throw createError({ statusCode: 429, message: `You can save up to ${DAILY_LIMIT} words a day` })

  const [row] = await db.insert(userWords).values({ userId: user.id, word: word.slice(0, MAX_CHARS * 2), term, sentence, partId })
    .onConflictDoNothing().returning()
  // Saved at the same moment from another tab: that one stands.
  const saved = row ?? (await db.select().from(userWords).where(and(eq(userWords.userId, user.id), eq(userWords.term, term))).limit(1))[0]
  if (!saved) throw createError({ statusCode: 500, message: 'The word could not be saved' })
  return { word: wordView(await defineSavedWord(saved, locale as WordLocale)), created: !!row }
})
