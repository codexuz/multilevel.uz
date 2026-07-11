<script setup lang="ts">
import type { CommunityPostDto } from '~/types/community'
import type { Paginated } from '~/types/models'

const toast = useToast()
const { confirm } = useConfirm()

const page = ref(1)
const { data, refresh } = await useFetch<Paginated<CommunityPostDto>>('/api/community', { query: { page } })

const posts = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 20)

useSeoMeta({
  title: 'Community',
  description: 'Ask questions, share your writing and speaking practice with other learners.'
})

async function removePost(id: string) {
  const ok = await confirm({
    title: 'Delete post?',
    description: 'This removes the post and hides its replies.',
    confirmLabel: 'Delete',
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/community/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Could not delete', description: (e as Error).message, color: 'error' })
  }
}
</script>

<template>
  <UContainer class="py-6 sm:py-8 max-w-2xl space-y-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold">
          Community
        </h1>
        <p class="text-muted">
          Ask questions, share your writing, and post speaking practice for feedback.
        </p>
      </div>
      <UButton
        to="/community/new"
        icon="i-lucide-pen-line"
        label="New post"
        class="shrink-0"
      />
    </div>

    <div
      v-if="posts.length"
      class="space-y-4"
    >
      <CommunityPostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        @delete="removePost"
      />
    </div>

    <UAlert
      v-else
      icon="i-lucide-messages-square"
      color="neutral"
      variant="subtle"
      title="No posts yet"
      description="Be the first to start a discussion."
      :actions="[{ label: 'Write a post', to: '/community/new' }]"
    />

    <div
      v-if="total > pageSize"
      class="flex justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
      />
    </div>
  </UContainer>
</template>
