<script setup lang="ts">
import type { CommunityPostDto } from '~/types/community'

const props = defineProps<{
  post: CommunityPostDto
  // On the thread page the body is shown in full and the card is not a link.
  detail?: boolean
}>()

defineEmits<{ delete: [id: string] }>()

const author = computed(() => props.post.author)
const isStaff = computed(() => author.value.role === 'admin' || author.value.role === 'examiner')
</script>

<template>
  <UCard>
    <div class="flex items-start gap-2.5 sm:gap-3">
      <UAvatar
        :src="author.avatarUrl || undefined"
        :alt="author.name || 'User'"
        size="md"
        class="shrink-0"
      />

      <div class="min-w-0 flex-1 space-y-2">
        <div class="flex items-start gap-2">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
            <span class="font-semibold text-highlighted truncate max-w-full">
              {{ author.name || 'Anonymous' }}
            </span>
            <UBadge
              v-if="isStaff"
              :label="author.role"
              color="primary"
              variant="subtle"
              size="sm"
            />
            <time
              class="text-xs text-muted whitespace-nowrap"
              :datetime="post.createdAt"
              :title="fullTime(post.createdAt)"
            >{{ timeAgo(post.createdAt) }}</time>
          </div>

          <UButton
            v-if="post.canDelete"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            size="xs"
            class="shrink-0 -mt-1 -mr-1"
            aria-label="Delete post"
            @click="$emit('delete', post.id)"
          />
        </div>

        <div
          v-if="detail"
          class="space-y-2"
        >
          <h2
            v-if="post.title"
            class="text-xl font-semibold text-highlighted"
          >
            {{ post.title }}
          </h2>
          <!-- eslint-disable vue/no-v-html -->
          <!-- Sanitized server-side by sanitizeRichText() before it is stored. -->
          <div
            class="prose prose-sm dark:prose-invert max-w-none break-words"
            v-html="post.body"
          />
          <!-- eslint-enable vue/no-v-html -->
        </div>

        <NuxtLink
          v-else
          :to="`/community/${post.id}`"
          class="block space-y-2"
        >
          <h2
            v-if="post.title"
            class="text-base font-semibold text-highlighted"
          >
            {{ post.title }}
          </h2>
          <!-- eslint-disable vue/no-v-html -->
          <div
            class="prose prose-sm dark:prose-invert max-w-none break-words line-clamp-4"
            v-html="post.body"
          />
          <!-- eslint-enable vue/no-v-html -->
        </NuxtLink>

        <CommunityAttachments :attachments="post.attachments" />

        <CommunityActions :post="post" />
      </div>
    </div>
  </UCard>
</template>
