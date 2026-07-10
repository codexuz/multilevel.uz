import { eq, desc, count, isNull } from 'drizzle-orm'
import { communityPosts, users } from '../../database/schema'
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

  return paginate(rows.map(r => ({
    id: r.id,
    title: r.title,
    body: r.body,
    attachments: toAttachments(r.attachments),
    replyCount: r.replyCount,
    createdAt: r.createdAt,
    author: toAuthor({ id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatarUrl, role: r.authorRole }),
    canDelete: canModerate(user, r.authorId)
  })), totalRow?.total ?? 0, p)
})
