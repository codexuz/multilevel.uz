import { communityPosts } from '../../database/schema'
import { toAttachments } from '~/types/community'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = useDb()
  const raw = await readBody(event)

  const title = readTitle(raw?.title)
  const body = readBodyText(raw?.body)
  const attachments = readAttachments(raw?.attachments)

  const [post] = await db.insert(communityPosts).values({
    userId: user.id,
    title,
    body,
    attachments
  }).returning()

  return {
    id: post!.id,
    title: post!.title,
    body: post!.body,
    attachments: toAttachments(post!.attachments),
    replyCount: post!.replyCount,
    likeCount: post!.likeCount,
    liked: false,
    createdAt: post!.createdAt
  }
})
