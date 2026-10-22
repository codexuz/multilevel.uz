import { packs } from '../../../database/schema'

// A new test pack, with its tests in order (`testIds`).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = (await readBody(event)) ?? {}
  const values = packValues(body, false)
  try {
    await useDb().transaction(async (tx) => {
      const [pack] = await tx.insert(packs).values(values as typeof packs.$inferInsert).returning()
      await setPackTests(tx, pack!.id, pack!.exam, body.testIds ?? [])
    })
  } catch (e: any) {
    if (e?.code === '23505') throw createError({ statusCode: 409, message: 'Another pack already uses this address' })
    throw e
  }
  return listPacks({ all: true, staff: true })
})
