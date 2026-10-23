import { eq } from 'drizzle-orm'
import { packs } from '../../../database/schema'

// Changes a test pack: its details, whether it is on sale, and (with `testIds`, `partIds`) its tests and single parts in order.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = (await readBody(event)) ?? {}
  const values = packValues(body, true)
  try {
    await useDb().transaction(async (tx) => {
      const [pack] = Object.keys(values).length
        ? await tx.update(packs).set(values).where(eq(packs.id, id)).returning()
        : await tx.select().from(packs).where(eq(packs.id, id)).limit(1)
      if (!pack) throw createError({ statusCode: 404, message: 'Pack not found' })
      if (body.testIds !== undefined) await setPackTests(tx, id, pack.exam, body.testIds)
      if (body.partIds !== undefined) await setPackParts(tx, id, pack.exam, body.partIds)
    })
  } catch (e: any) {
    if ((e?.code ?? e?.cause?.code) === '23505') throw createError({ statusCode: 409, message: 'Another pack already uses this address' })
    throw e
  }
  return listPacks({ all: true, staff: true })
})
