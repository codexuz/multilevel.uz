import { eq } from 'drizzle-orm'
import { courses } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const body = await readBody<{
    title?: string
    description?: string
    level?: string
    category?: string
    isPremium?: boolean
  }>(event)

  if (!body.title?.trim()) throw createError({ statusCode: 400, message: 'Title is required' })

  const db = useDb()
  const base = slugify(body.title)
  // Ensure slug uniqueness by appending a short suffix on collision.
  let slug = base
  for (let i = 0; i < 20; i++) {
    const [clash] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).limit(1)
    if (!clash) break
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }

  const [row] = await db.insert(courses).values({
    title: body.title.trim(),
    slug,
    description: body.description ?? null,
    level: body.level ?? null,
    category: body.category ?? null,
    isPremium: !!body.isPremium,
    createdBy: user.id
  }).returning()

  return { id: row!.id, slug: row!.slug }
})
