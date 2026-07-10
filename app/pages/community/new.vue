<script setup lang="ts">
import type { Attachment, CommunityPostDto } from '~/types/community'

const toast = useToast()
const submitting = ref(false)

useSeoMeta({
  title: 'New post',
  description: 'Start a discussion with the Multilevel community.'
})

async function createPost(payload: { title: string | null, body: string, attachments: Attachment[] }) {
  submitting.value = true
  try {
    const post = await $fetch<CommunityPostDto>('/api/community', { method: 'POST', body: payload })
    toast.add({ title: 'Posted', color: 'success' })
    // Land on the new thread rather than back on the feed.
    await navigateTo(`/community/${post.id}`)
  } catch (e) {
    toast.add({
      title: 'Could not post',
      description: (e as { data?: { message?: string } })?.data?.message ?? 'Please try again.',
      color: 'error'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-2xl space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        to="/community"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        aria-label="Back to community"
      />
      <div>
        <h1 class="text-2xl font-bold">
          New post
        </h1>
        <p class="text-muted text-sm">
          Ask a question, share your writing, or post a voice recording for feedback.
        </p>
      </div>
    </div>

    <CommunityComposer
      v-model:submitting="submitting"
      with-title
      placeholder="Ask a question or share your practice…"
      submit-label="Publish"
      min-height="min-h-48"
      @submit="createPost"
    />
  </UContainer>
</template>
