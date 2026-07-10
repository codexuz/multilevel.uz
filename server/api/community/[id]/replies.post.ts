import { eq, and, isNull, sql } from 'drizzle-orm'
import { communityPosts, communityReplies } from '../../../database/schema'
import { toAttachments } from '~/types/community'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const db = useDb()
  const raw = await readBody(event)

  const body = readBodyText(raw?.body)
  const attachments = readAttachments(raw?.attachments)

  const [post] = await db.select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(eq(communityPosts.id, id), isNull(communityPosts.deletedAt)))
    .limit(1)
  if (!post) throw createError({ statusCode: 404, message: 'Post not found' })

  const [reply] = await db.insert(communityReplies).values({
    postId: id,
    userId: user.id,
    body,
    attachments
  }).returning()

  await db.update(communityPosts)
    .set({ replyCount: sql`${communityPosts.replyCount} + 1`, updatedAt: new Date() })
    .where(eq(communityPosts.id, id))

  return {
    id: reply!.id,
    postId: reply!.postId,
    body: reply!.body,
    attachments: toAttachments(reply!.attachments),
    createdAt: reply!.createdAt
  }
})
