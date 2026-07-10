import { eq, and, isNull, sql, gt } from 'drizzle-orm'
import { communityPosts, communityPostLikes } from '../../../database/schema'

// Toggle the current user's like. The insert/delete and the counter update run
// in one transaction, and the unique index makes a double-click idempotent
// rather than a double count.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [post] = await db.select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, id), isNull(communityPosts.deletedAt)))
    .limit(1)
  if (!post) throw createError({ statusCode: 404, message: 'Post not found' })

  const liked = await db.transaction(async (tx) => {
    const inserted = await tx.insert(communityPostLikes)
      .values({ postId: id, userId: user.id })
      .onConflictDoNothing()
      .returning({ postId: communityPostLikes.postId })

    if (inserted.length) {
      await tx.update(communityPosts)
        .set({ likeCount: sql`${communityPosts.likeCount} + 1` })
        .where(eq(communityPosts.id, id))
      return true
    }

    await tx.delete(communityPostLikes)
      .where(and(eq(communityPostLikes.postId, id), eq(communityPostLikes.userId, user.id)))
    // `gt(likeCount, 0)` keeps the tally from going negative if it ever drifts.
    await tx.update(communityPosts)
      .set({ likeCount: sql`${communityPosts.likeCount} - 1` })
      .where(and(eq(communityPosts.id, id), gt(communityPosts.likeCount, 0)))
    return false
  })

  const [row] = await db.select({ likeCount: communityPosts.likeCount })
    .from(communityPosts)
    .where(eq(communityPosts.id, id))
    .limit(1)

  return { liked, likeCount: row?.likeCount ?? 0 }
})
