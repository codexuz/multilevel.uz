import { eq, desc, count, isNull, and, inArray } from 'drizzle-orm'
import { communityPosts, communityPostLikes, users } from '../../database/schema'
import { toAttachments } from '~/types/community'

// Paginated community feed, newest first. Soft-deleted posts are hidden.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()
  const p = getPagination(event)

  const where = isNull(communityPosts.deletedAt)

  const [totalRow] = await db.select({ total: count() }).from(communityPosts).where(where)
  const rows = await db.select({
    id: communityPosts.id,
    title: communityPosts.title,
    body: communityPosts.body,
    attachments: communityPosts.attachments,
    replyCount: communityPosts.replyCount,
    likeCount: communityPosts.likeCount,
    createdAt: communityPosts.createdAt,
    authorId: users.id,
    authorName: users.name,
    authorAvatarUrl: users.avatarUrl,
    authorRole: users.role
  }).from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.userId))
    .where(where)
    .orderBy(desc(communityPosts.createdAt))
    .limit(p.pageSize).offset(p.offset)

  // One extra query for the whole page rather than a correlated subquery per row.
  const ids = rows.map(r => r.id)
  const likedRows = ids.length
    ? await db.select({ postId: communityPostLikes.postId })
        .from(communityPostLikes)
        .where(and(eq(communityPostLikes.userId, user.id), inArray(communityPostLikes.postId, ids)))
    : []
  const likedSet = new Set(likedRows.map(l => l.postId))

  return paginate(rows.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    attachments: toAttachments(r.attachments),
    replyCount: r.replyCount,
    likeCount: r.likeCount,
    liked: likedSet.has(r.id),
    createdAt: r.createdAt,
    author: toAuthor({ id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatarUrl, role: r.authorRole }),
    canDelete: canModerate(user, r.authorId)
  })), totalRow?.total ?? 0, p)
})
