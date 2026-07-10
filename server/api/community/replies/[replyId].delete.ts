import { eq, and, isNull, sql, gt } from 'drizzle-orm'
import { communityPosts, communityReplies } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const replyId = getRouterParam(event, 'replyId')!
  const db = useDb()

  const [reply] = await db.select({ userId: communityReplies.userId, postId: communityReplies.postId })
    .from(communityReplies)
    .where(and(eq(communityReplies.id, replyId), isNull(communityReplies.deletedAt)))
    .limit(1)

  if (!reply) throw createError({ statusCode: 404, message: 'Reply not found' })
  if (!canModerate(user, reply.userId)) throw createError({ statusCode: 403, message: 'Forbidden' })

  await db.update(communityReplies)
    .set({ deletedAt: new Date() })
    .where(eq(communityReplies.id, replyId))

  // `gt(replyCount, 0)` keeps the counter from going negative if this row is
  // somehow deleted twice.
  await db.update(communityPosts)
    .set({ replyCount: sql`${communityPosts.replyCount} - 1`, updatedAt: new Date() })
    .where(and(eq(communityPosts.id, reply.postId), gt(communityPosts.replyCount, 0)))

  return { ok: true }
})
