import { and, asc, eq, inArray, or, sql } from 'drizzle-orm'
import { orders, packParts, packTests, packs, partUnlocks, parts, sectionItems, sections, speakingParts, testUnlocks, tests, writingTasks } from '../database/schema'

/**
 * Test packs: a set of tests, single parts, or both, sold once (ten authentic IELTS Academic tests,
 * say, or twenty Reading passages). Paying opens each test in the pack for good, the same way a
 * test opened with credits is (test_unlocks), and each part on its own (part_unlocks), so a pack
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

/** What a part shows of itself: its skill, number and title, and the test it is from. */
const PART_COLUMNS = {
  id: sectionItems.id, skill: sections.skill,
  number: sql<number | null>`coalesce(${parts.partNumber}, ${writingTasks.taskNumber}, ${speakingParts.partNumber})`,
  title: sql<string | null>`coalesce(${parts.title}, ${writingTasks.title}, ${speakingParts.title})`,
  testId: tests.id, testSlug: tests.slug, testTitle: tests.title, module: tests.module, status: tests.status
}

/** A part as the site shows it. */
const partView = (i: { id: string, skill: string, number: number | null, title: string | null, module: string | null, status: string, testId: string, testSlug: string, testTitle: string }) => ({
  id: i.id, skill: i.skill, number: i.number, title: i.title, exam: examOfModule(i.module), status: i.status,
  test: { id: i.testId, slug: i.testSlug, title: i.testTitle, module: i.module }
})

/** The single parts of some packs, in their order. */
async function partsOf(packIds: string[]) {
  if (!packIds.length) return []
  return useDb().select({
    packId: packParts.packId, position: packParts.position,
    ...PART_COLUMNS
  }).from(packParts)
    .innerJoin(sectionItems, eq(sectionItems.id, packParts.sectionItemId))
    .innerJoin(sections, eq(sections.id, sectionItems.sectionId))
    .innerJoin(tests, eq(tests.id, sections.testId))
    .leftJoin(parts, eq(parts.id, sectionItems.partId))
    .leftJoin(writingTasks, eq(writingTasks.id, sectionItems.writingTaskId))
    .leftJoin(speakingParts, eq(speakingParts.id, sectionItems.speakingPartId))
    .where(inArray(packParts.packId, packIds)).orderBy(asc(packParts.position))
}

/** Packs this user has paid for. */
export async function ownedPackIds(userId: string | null | undefined) {
  if (!userId) return new Set<string>()
  const rows = await useDb().selectDistinct({ packId: orders.packId }).from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.status, 'PAID'), sql`${orders.packId} is not null`))
  return new Set(rows.map(r => r.packId!))
}

export function packView(p: typeof packs.$inferSelect, list: Awaited<ReturnType<typeof testsOf>>, partList: Awaited<ReturnType<typeof partsOf>>, owned: Set<string>, opts: { staff?: boolean } = {}) {
  // Candidates see what is published only; staff see what is in it, drafts too.
  const mine = list.filter(t => t.packId === p.id && (opts.staff || t.status === 'PUBLISHED'))
  const myParts = partList.filter(i => i.packId === p.id && (opts.staff || i.status === 'PUBLISHED'))
  return {
    id: p.id, slug: p.slug, title: p.title, description: p.description, exam: p.exam,
    priceUzs: p.priceUzs, oldPriceUzs: p.oldPriceUzs, coverUrl: p.coverUrl, featured: p.featured, active: p.active, position: p.position,
    owned: owned.has(p.id),
    testCount: mine.length,
    tests: mine.map(t => ({ id: t.id, slug: t.slug, title: t.title, module: t.module, exam: examOfModule(t.module), category: t.category, status: t.status })),
    partCount: myParts.length,
    parts: myParts.map(partView)
  }
}

/** The packs on sale, for an exam or all, the featured and the first placed first. */
export async function listPacks(opts: { exam?: unknown, userId?: string | null, all?: boolean, staff?: boolean } = {}) {
  const db = useDb()
  const rows = await db.select().from(packs).where(and(
    opts.all ? undefined : eq(packs.active, true),
    isExam(opts.exam) ? eq(packs.exam, opts.exam) : undefined
  )).orderBy(asc(packs.position), asc(packs.createdAt))
  const ids = rows.map(r => r.id)
  const [list, partList, owned] = await Promise.all([testsOf(ids), partsOf(ids), ownedPackIds(opts.userId)])
  return rows.map(p => packView(p, list, partList, owned, { staff: opts.staff })).filter(p => opts.all || p.testCount + p.partCount > 0)
}

export async function packBySlug(slug: string, userId?: string | null) {
  const [p] = await useDb().select().from(packs).where(and(eq(packs.slug, slug), eq(packs.active, true))).limit(1)
  if (!p) throw createError({ statusCode: 404, message: 'Pack not found' })
  const [list, partList, owned] = await Promise.all([testsOf([p.id]), partsOf([p.id]), ownedPackIds(userId)])
  return packView(p, list, partList, owned)
}

/** The packs a test, or some of its parts, is sold in, for its page. */
export async function packsOfTest(testId: string, userId?: string | null) {
  const rows = await useDb().select({ pack: packs }).from(packs).where(and(eq(packs.active, true), or(
    sql`exists (select 1 from ${packTests} pt where pt.pack_id = ${packs.id} and pt.test_id = ${testId})`,
    sql`exists (select 1 from ${packParts} pp join ${sectionItems} si on si.id = pp.section_item_id join ${sections} s on s.id = si.section_id where pp.pack_id = ${packs.id} and s.test_id = ${testId})`
  )))
  const owned = await ownedPackIds(userId)
  return rows.map(({ pack: p }) => ({ id: p.id, slug: p.slug, title: p.title, priceUzs: p.priceUzs, oldPriceUzs: p.oldPriceUzs, owned: owned.has(p.id) }))
}

/** A paid pack opens its tests and parts for the buyer, for good (once, however often it is fulfilled). */
export async function unlockPack(tx: Tx, userId: string, packId: string) {
  const [rows, items] = await Promise.all([
    tx.select({ testId: packTests.testId }).from(packTests).where(eq(packTests.packId, packId)),
    tx.select({ sectionItemId: packParts.sectionItemId }).from(packParts).where(eq(packParts.packId, packId))
  ])
  if (rows.length) await tx.insert(testUnlocks).values(rows.map(r => ({ userId, testId: r.testId }))).onConflictDoNothing()
  if (items.length) await tx.insert(partUnlocks).values(items.map(r => ({ userId, sectionItemId: r.sectionItemId }))).onConflictDoNothing()
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

/** Puts these single parts (section items) in the pack, in this order (parts of the pack's exam only). */
export async function setPackParts(tx: Tx, packId: string, exam: string, itemIds: unknown) {
  if (!Array.isArray(itemIds)) return
  const ids = [...new Set(itemIds.map(String))]
  const found = ids.length
    ? await tx.select({ id: sectionItems.id, module: tests.module }).from(sectionItems)
        .innerJoin(sections, eq(sections.id, sectionItems.sectionId)).innerJoin(tests, eq(tests.id, sections.testId))
        .where(inArray(sectionItems.id, ids))
    : []
  if (found.length !== ids.length) throw bad('Some of these parts do not exist')
  if (found.some(t => examOfModule(t.module) !== exam)) throw bad(`A ${exam === 'IELTS' ? 'IELTS' : 'Multilevel'} pack holds ${exam === 'IELTS' ? 'IELTS' : 'Multilevel'} parts only`)
  await tx.delete(packParts).where(eq(packParts.packId, packId))
  if (ids.length) await tx.insert(packParts).values(ids.map((sectionItemId, i) => ({ packId, sectionItemId, position: i + 1 })))
}

/** Every part that can go in a pack of this exam (drafts too, not archived tests), newest test first. */
export async function packableParts(exam: Exam) {
  const rows = await useDb().select(PART_COLUMNS).from(sectionItems)
    .innerJoin(sections, eq(sections.id, sectionItems.sectionId))
    .innerJoin(tests, eq(tests.id, sections.testId))
    .leftJoin(parts, eq(parts.id, sectionItems.partId))
    .leftJoin(writingTasks, eq(writingTasks.id, sectionItems.writingTaskId))
    .leftJoin(speakingParts, eq(speakingParts.id, sectionItems.speakingPartId))
    .where(sql`${tests.status} <> 'ARCHIVED'`)
    .orderBy(sql`${tests.createdAt} desc`, asc(sections.position), asc(sectionItems.position))
  return rows.filter(r => examOfModule(r.module) === exam).map(partView)
}
