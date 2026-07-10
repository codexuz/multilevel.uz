<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { CommunityPostDto, LikeResultDto } from '~/types/community'

const props = defineProps<{ post: CommunityPostDto }>()

const toast = useToast()

// Seeded from the server, then owned locally so the button responds instantly.
const liked = ref(props.post.liked)
const likeCount = ref(props.post.likeCount)
const pending = ref(false)

watch(() => props.post, (post) => {
  liked.value = post.liked
  likeCount.value = post.likeCount
})

const url = useRequestURL()
const shareUrl = computed(() => `${url.origin}/community/${props.post.id}`)
const shareTitle = computed(() => props.post.title || 'Multilevel community post')

async function toggleLike() {
  if (pending.value) return
  pending.value = true

  // Optimistic: flip now, reconcile with the server's authoritative tally.
  const wasLiked = liked.value
  liked.value = !wasLiked
  likeCount.value += wasLiked ? -1 : 1

  try {
    const result = await $fetch<LikeResultDto>(`/api/community/${props.post.id}/like`, { method: 'POST' })
    liked.value = result.liked
    likeCount.value = result.likeCount
  } catch {
    liked.value = wasLiked
    likeCount.value += wasLiked ? 1 : -1
    toast.add({ title: 'Could not update like', color: 'error' })
  } finally {
    pending.value = false
  }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    toast.add({ title: 'Link copied', icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy link', color: 'error' })
  }
}

/** The OS share sheet, where the browser offers one. */
async function nativeShare() {
  if (!navigator.share) return copyLink()
  try {
    await navigator.share({ title: shareTitle.value, url: shareUrl.value })
  } catch {
    // The user dismissed the sheet — not an error worth surfacing.
  }
}

const shareItems = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Copy link', icon: 'i-lucide-link', onSelect: copyLink },
  {
    label: 'Share on Telegram',
    icon: 'i-simple-icons-telegram',
    to: `https://t.me/share/url?url=${encodeURIComponent(shareUrl.value)}&text=${encodeURIComponent(shareTitle.value)}`,
    target: '_blank'
  },
  { label: 'More…', icon: 'i-lucide-share-2', onSelect: nativeShare }
]])
</script>

<template>
  <div class="flex items-center gap-1">
    <UButton
      icon="i-lucide-heart"
      :color="liked ? 'error' : 'neutral'"
      variant="ghost"
      size="sm"
      :aria-pressed="liked"
      :aria-label="liked ? 'Unlike' : 'Like'"
      :ui="{ leadingIcon: liked ? 'fill-current' : undefined }"
      @click="toggleLike"
    >
      {{ likeCount }}
    </UButton>

    <UButton
      :to="`/community/${post.id}`"
      icon="i-lucide-message-circle"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="`${post.replyCount} replies`"
    >
      {{ post.replyCount }}
    </UButton>

    <UDropdownMenu :items="shareItems">
      <UButton
        icon="i-lucide-share-2"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Share post"
      />
    </UDropdownMenu>
  </div>
</template>
