import { eq, asc, and, isNull } from 'drizzle-orm'
import { communityPosts, communityPostLikes, communityReplies, users } from '../../../database/schema'
import { toAttachments } from '~/types/community'

// A single thread: the post plus its replies, oldest first.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()

  const [row] = await db.select({
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
    .where(and(eq(communityPosts.id, id), isNull(communityPosts.deletedAt)))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Post not found' })

  const [like] = await db.select({ postId: communityPostLikes.postId })
    .from(communityPostLikes)
    .where(and(eq(communityPostLikes.postId, id), eq(communityPostLikes.userId, user.id)))
    .limit(1)

  const replyRows = await db.select({
    id: communityReplies.id,
    postId: communityReplies.postId,
    body: communityReplies.body,
    attachments: communityReplies.attachments,
    createdAt: communityReplies.createdAt,
    authorId: users.id,
    authorName: users.name,
    authorAvatarUrl: users.avatarUrl,
    authorRole: users.role
  }).from(communityReplies)
    .innerJoin(users, eq(users.id, communityReplies.userId))
    .where(and(eq(communityReplies.postId, id), isNull(communityReplies.deletedAt)))
    .orderBy(asc(communityReplies.createdAt))

  return {
    post: {
      id: row.id,
      title: row.title,
      body: row.body,
      attachments: toAttachments(row.attachments),
      replyCount: row.replyCount,
      likeCount: row.likeCount,
      liked: !!like,
      createdAt: row.createdAt,
      author: toAuthor({ id: row.authorId, name: row.authorName, avatarUrl: row.authorAvatarUrl, role: row.authorRole }),
      canDelete: canModerate(user, row.authorId)
    },
    replies: replyRows.map(r => ({
      id: r.id,
      postId: r.postId,
      body: r.body,
      attachments: toAttachments(r.attachments),
      createdAt: r.createdAt,
      author: toAuthor({ id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatarUrl, role: r.authorRole }),
      canDelete: canModerate(user, r.authorId)
    }))
  }
})
