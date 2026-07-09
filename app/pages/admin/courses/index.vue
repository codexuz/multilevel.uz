<script setup lang="ts">
import type { CourseListItemDto, Paginated } from '~/types/models'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const toast = useToast()
const { confirm } = useConfirm()
const courses = ref<CourseListItemDto[]>([])
const loading = ref(true)
const page = ref(1)
const total = ref(0)
const pageSize = ref(20)

function errMsg(e: unknown) {
  return (e as { data?: { message?: string } })?.data?.message ?? 'Failed'
}

async function refresh() {
  loading.value = true
  try {
    const res = await $fetch<Paginated<CourseListItemDto>>('/api/admin/courses', { query: { page: page.value } })
    courses.value = res.items
    total.value = res.total
    pageSize.value = res.pageSize
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    loading.value = false
  }
}
watch(page, refresh)

async function togglePublish(c: CourseListItemDto) {
  const next = c.status === 'published' ? 'draft' : 'published'
  try {
    await $fetch(`/api/admin/courses/${c.id}`, { method: 'PATCH', body: { status: next } })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}
async function remove(c: CourseListItemDto) {
  if (!await confirm({
    title: `Delete "${c.title}"?`,
    description: 'This removes all its modules, lessons and enrollments.',
    confirmLabel: 'Delete',
    color: 'error'
  })) return
  try {
    await $fetch(`/api/admin/courses/${c.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}

onMounted(refresh)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Courses
      </h1>
      <UButton
        to="/admin/courses/new"
        icon="i-lucide-plus"
        label="New course"
      />
    </div>

    <div
      v-if="loading"
      class="text-muted"
    >
      Loading…
    </div>

    <UCard
      v-else-if="courses.length"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <div class="divide-y divide-default">
        <div
          v-for="c in courses"
          :key="c.id"
          class="flex items-center gap-4 p-4"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <NuxtLink
                :to="`/admin/courses/${c.id}`"
                class="font-medium hover:text-primary truncate"
              >
                {{ c.title }}
              </NuxtLink>
              <UBadge
                v-if="c.isPremium"
                color="primary"
                variant="subtle"
                size="sm"
                label="Premium"
              />
            </div>
            <p class="text-xs text-muted truncate">
              {{ c.lessonCount }} lessons · {{ c.category || 'Uncategorized' }}{{ c.level ? ` · ${c.level}` : '' }}
            </p>
          </div>
          <UBadge
            :color="c.status === 'published' ? 'success' : 'neutral'"
            variant="subtle"
            :label="c.status"
          />
          <UButton
            :to="`/admin/courses/${c.id}`"
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
          />
          <UButton
            :icon="c.status === 'published' ? 'i-lucide-eye-off' : 'i-lucide-globe'"
            variant="ghost"
            color="neutral"
            @click="togglePublish(c)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            @click="remove(c)"
          />
        </div>
      </div>
    </UCard>

    <UAlert
      v-else
      icon="i-lucide-inbox"
      color="neutral"
      variant="subtle"
      title="No courses yet"
      description="Create your first course to get started."
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
  </div>
</template>
