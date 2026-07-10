export type AttachmentType = 'image' | 'audio'

export interface Attachment {
  type: AttachmentType
  url: string
}

export interface CommunityAuthor {
  id: string
  name: string | null
  avatarUrl: string | null
  role: string
}

export interface CommunityPostDto {
  id: string
  title: string | null
  body: string
  attachments: Attachment[]
  replyCount: number
  likeCount: number
  /** Whether the requesting user has liked this post. */
  liked: boolean
  createdAt: string
  author: CommunityAuthor
  /** Whether the requesting user may delete this post. */
  canDelete: boolean
}

export interface LikeResultDto {
  liked: boolean
  likeCount: number
}

export interface CommunityReplyDto {
  id: string
  postId: string
  body: string
  attachments: Attachment[]
  createdAt: string
  author: CommunityAuthor
  canDelete: boolean
}

export interface CommunityThreadDto {
  post: CommunityPostDto
  replies: CommunityReplyDto[]
}

export const MAX_ATTACHMENTS = 4
export const MAX_BODY_LENGTH = 20_000
export const MAX_TITLE_LENGTH = 200

/** Runtime guard for the untyped `attachments` jsonb column. */
export function isAttachment(value: unknown): value is Attachment {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  return (a.type === 'image' || a.type === 'audio') && typeof a.url === 'string'
}

export function toAttachments(value: unknown): Attachment[] {
  return Array.isArray(value) ? value.filter(isAttachment) : []
}
