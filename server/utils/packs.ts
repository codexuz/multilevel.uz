import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { orders, packTests, packs, testUnlocks, tests } from '../database/schema'

/**
 * Test packs: a set of tests sold once (ten authentic IELTS Academic tests, say). Paying opens each
 * test in the pack for good, the same way a test opened with credits is (test_unlocks), so a pack
 * keeps working after Premium ends. A pack is bought by the order that names it.
 */

type Body = Record<string, any>
type Db = ReturnType<typeof useDb>
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
const bad = (message: string) => createError({ statusCode: 400, message })

/** The tests of some packs, in their order, with what a card shows of each. */
async function testsOf(packIds: string[]) {
  if (!packIds.length) return []
  return useDb().select({
    packId: packTests.packId, position: packTests.position,
    id: tests.id, slug: tests.slug, title: tests.title, module: tests.module, category: tests.category, status: tests.status, access: tests.access
  }).from(packTests).innerJoin(tests, eq(tests.id, packTests.testId))
    .where(inArray(packTests.packId, packIds)).orderBy(asc(packTests.position))
}

/** Packs this user has paid for. */
export async function ownedPackIds(userId: string | null | undefined) {
  if (!userId) return new Set<string>()
  const rows = await useDb().selectDistinct({ packId: orders.packId }).from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'PAID'), sql`${orders.packId} is not null`))
  return new Set(rows.map(r => r.packId!))
}

export function packView(p: typeof packs.$inferSelect, list: Awaited<ReturnType<typeof testsOf>>, owned: Set<string>, opts: { staff?: boolean } = {}) {
  // Candidates see the published tests only; staff see what is in it, drafts too.
  const mine = list.filter(t => t.packId === p.id && (opts.staff || t.status === 'PUBLISHED'))
  return {
    id: p.id, slug: p.slug, title: p.title, description: p.description, exam: p.exam,
    priceUzs: p.priceUzs, oldPriceUzs: p.oldPriceUzs, coverUrl: p.coverUrl, featured: p.featured, active: p.active, position: p.position,
    owned: owned.has(p.id),
    testCount: mine.length,
    tests: mine.map(t => ({ id: t.id, slug: t.slug, title: t.title, module: t.module, exam: examOfModule(t.module), category: t.category, status: t.status }))
  }
}

/** The packs on sale, for an exam or all, the featured and the first placed first. */
export async function listPacks(opts: { exam?: unknown, userId?: string | null, all?: boolean, staff?: boolean } = {}) {
  const db = useDb()
  const rows = await db.select().from(packs).where(and(
    opts.all ? undefined : eq(packs.active, true),
    isExam(opts.exam) ? eq(packs.exam, opts.exam) : undefined
  )).orderBy(asc(packs.position), asc(packs.createdAt))
  const [list, owned] = await Promise.all([testsOf(rows.map(r => r.id)), ownedPackIds(opts.userId)])
  return rows.map(p => packView(p, list, owned, { staff: opts.staff })).filter(p => opts.all || p.testCount > 0)
}

export async function packBySlug(slug: string, userId?: string | null) {
  const [p] = await useDb().select().from(packs).where(and(eq(packs.slug, slug), eq(packs.active, true))).limit(1)
  if (!p) throw createError({ statusCode: 404, message: 'Pack not found' })
  const [list, owned] = await Promise.all([testsOf([p.id]), ownedPackIds(userId)])
  return packView(p, list, owned)
}

/** The packs a test is sold in, for its page. */
export async function packsOfTest(testId: string, userId?: string | null) {
  const rows = await useDb().select({ pack: packs }).from(packTests).innerJoin(packs, eq(packs.id, packTests.packId))
    .where(and(eq(packTests.testId, testId), eq(packs.active, true)))
  const owned = await ownedPackIds(userId)
  return rows.map(({ pack: p }) => ({ id: p.id, slug: p.slug, title: p.title, priceUzs: p.priceUzs, oldPriceUzs: p.oldPriceUzs, owned: owned.has(p.id) }))
}

/** A paid pack opens its tests for the buyer, for good (once, however often it is fulfilled). */
export async function unlockPack(tx: Tx, userId: string, packId: string) {
  const rows = await tx.select({ testId: packTests.testId }).from(packTests).where(eq(packTests.packId, packId))
  if (rows.length) await tx.insert(testUnlocks).values(rows.map(r => ({ userId, testId: r.testId }))).onConflictDoNothing()
}

/** A pack as an admin writes it; only the fields given are kept. */
export function packValues(body: Body, partial: boolean) {
  const out: Partial<typeof packs.$inferInsert> = {}
  const int = (v: unknown, min: number, max: number) => (Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Math.round(Number(v)))) : null)
  if (body.title !== undefined || !partial) {
    const title = String(body.title ?? '').trim()
    if (!title) throw bad('The pack needs a title')
    out.title = title.slice(0, 160)
  }
  if (body.slug !== undefined || !partial) {
    const slug = slugify(String(body.slug || body.title || ''))
    if (!slug) throw bad('The pack needs an address')
    out.slug = slug
  }
  if (body.description !== undefined) out.description = String(body.description ?? '').trim().slice(0, 2000) || null
  if (body.exam !== undefined || !partial) {
    if (!isExam(body.exam)) throw bad('A pack is for IELTS or Multilevel')
    out.exam = body.exam
  }
  if (body.priceUzs !== undefined || !partial) {
    const price = int(body.priceUzs, 1000, 100_000_000)
    if (price == null) throw bad('The price is at least 1,000 so\'m')
    out.priceUzs = price
  }
  if (body.oldPriceUzs !== undefined) out.oldPriceUzs = body.oldPriceUzs == null || body.oldPriceUzs === '' ? null : int(body.oldPriceUzs, 0, 100_000_000)
  if (body.coverUrl !== undefined) out.coverUrl = String(body.coverUrl ?? '').trim() || null
  if (body.featured !== undefined) out.featured = !!body.featured
  if (body.active !== undefined) out.active = !!body.active
  if (body.position !== undefined) out.position = int(body.position, 1, 1000) ?? 1
  return out
}

/** Puts these tests in the pack, in this order (tests of the pack's exam only). */
export async function setPackTests(tx: Tx, packId: string, exam: string, testIds: unknown) {
  if (!Array.isArray(testIds)) return
  const ids = [...new Set(testIds.map(String))]
  const found = ids.length ? await tx.select({ id: tests.id, module: tests.module }).from(tests).where(inArray(tests.id, ids)) : []
  if (found.length !== ids.length) throw bad('Some of these tests do not exist')
  if (found.some(t => examOfModule(t.module) !== exam)) throw bad(`A ${exam === 'IELTS' ? 'IELTS' : 'Multilevel'} pack holds ${exam === 'IELTS' ? 'IELTS' : 'Multilevel'} tests only`)
  await tx.delete(packTests).where(eq(packTests.packId, packId))
  if (ids.length) await tx.insert(packTests).values(ids.map((testId, i) => ({ packId, testId, position: i + 1 })))
}
