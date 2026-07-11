<script setup lang="ts">
import type { Attachment, CommunityThreadDto } from '~/types/community'

const route = useRoute()
const postId = route.params.id as string
const toast = useToast()
const { confirm } = useConfirm()

const { data, refresh, error } = await useFetch<CommunityThreadDto>(`/api/community/${postId}`)

const composer = ref<{ reset: () => void }>()
const submitting = ref(false)

useSeoMeta({
  title: () => data.value?.post.title || 'Community post'
})

async function addReply(payload: { body: string, attachments: Attachment[] }) {
  submitting.value = true
  try {
    await $fetch(`/api/community/${postId}/replies`, {
      method: 'POST',
      body: { body: payload.body, attachments: payload.attachments }
    })
    composer.value?.reset()
    await refresh()
  } catch (e) {
    toast.add({ title: 'Could not reply', description: (e as Error).message, color: 'error' })
  } finally {
    submitting.value = false
  }
}

async function removePost() {
  const ok = await confirm({
    title: 'Delete post?',
    description: 'This removes the post and hides its replies.',
    confirmLabel: 'Delete',
    color: 'error'
  })
  if (!ok) return
  await $fetch(`/api/community/${postId}`, { method: 'DELETE' })
  await navigateTo('/community')
}

async function removeReply(replyId: string) {
  const ok = await confirm({
    title: 'Delete reply?',
    confirmLabel: 'Delete',
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/community/replies/${replyId}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Could not delete', description: (e as Error).message, color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-6 sm:py-8 max-w-2xl space-y-6">
    <UButton
      to="/community"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      label="Community"
    />

    <div
      v-if="error"
      class="space-y-3 text-center py-12"
    >
      <UIcon
        name="i-lucide-message-circle-off"
        class="size-10 text-muted"
      />
      <p class="text-muted">
        This post no longer exists.
      </p>
    </div>

    <template v-else-if="data">
      <CommunityPostCard
        :post="data.post"
        detail
        @delete="removePost"
      />

      <div class="space-y-3">
        <h2 class="font-semibold">
          {{ data.replies.length }} {{ data.replies.length === 1 ? 'reply' : 'replies' }}
        </h2>

        <UCard
          v-for="reply in data.replies"
          :key="reply.id"
        >
          <div class="flex items-start gap-2.5 sm:gap-3">
            <UAvatar
              :src="reply.author.avatarUrl || undefined"
              :alt="reply.author.name || 'User'"
              size="sm"
              class="shrink-0"
            />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex items-start gap-2">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
                  <span class="text-sm font-semibold text-highlighted truncate max-w-full">
                    {{ reply.author.name || 'Anonymous' }}
                  </span>
                  <time
                    class="text-xs text-muted whitespace-nowrap"
                    :datetime="reply.createdAt"
                    :title="fullTime(reply.createdAt)"
                  >{{ timeAgo(reply.createdAt) }}</time>
                </div>
                <UButton
                  v-if="reply.canDelete"
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  class="shrink-0 -mt-1 -mr-1"
                  aria-label="Delete reply"
                  @click="removeReply(reply.id)"
                />
              </div>
              <!-- eslint-disable vue/no-v-html -->
              <!-- Sanitized server-side before storage. -->
              <div
                class="prose prose-sm dark:prose-invert max-w-none break-words"
                v-html="reply.body"
              />
              <!-- eslint-enable vue/no-v-html -->
              <CommunityAttachments :attachments="reply.attachments" />
            </div>
          </div>
        </UCard>
      </div>

      <CommunityComposer
        ref="composer"
        v-model:submitting="submitting"
        placeholder="Write a reply…"
        submit-label="Reply"
        min-height="min-h-24"
        @submit="addReply"
      />
    </template>
  </UContainer>
</template>
