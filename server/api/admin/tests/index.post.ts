import { tests } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const body = await readBody<{
    title?: string
    description?: string
    level?: string
    isPremium?: boolean
  }>(event)

  if (!body.title?.trim()) throw createError({ statusCode: 400, message: 'Title is required' })

  const db = useDb()
  const [row] = await db.insert(tests).values({
    title: body.title.trim(),
    description: body.description ?? null,
    level: body.level ?? null,
    isPremium: !!body.isPremium,
    createdBy: user.id
  }).returning()

  return { id: row!.id }
})
