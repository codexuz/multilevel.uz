import { eq, and, isNull } from 'drizzle-orm'
import { communityPosts } from '../../../database/schema'

// Soft delete: the row stays so replies keep their foreign key.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [post] = await db.select({ userId: communityPosts.userId })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, id), isNull(communityPosts.deletedAt)))
    .limit(1)

  if (!post) throw createError({ statusCode: 404, message: 'Post not found' })
  if (!canModerate(user, post.userId)) throw createError({ statusCode: 403, message: 'Forbidden' })

  await db.update(communityPosts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(communityPosts.id, id))

  return { ok: true }
})
