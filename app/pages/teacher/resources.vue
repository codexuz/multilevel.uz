<script setup lang="ts">
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
const { t } = useI18n()
useSeoMeta({ title: () => t('panel.resources'), robots: 'noindex' })

interface ResourceItem {
  id: string
  kind: 'PDF' | 'VIDEO' | 'AUDIO'
  name: string
  url: string
  size: number | null
  courseTitle: string
  courseId: string
  lessonTitle: string
  createdAt: string
}

const kindFilter = ref('ALL')
const search = ref('')
const { data } = await useFetch<{ resources: ResourceItem[] }>('/api/teacher/resources', {
  default: () => ({ resources: [] })
})

const filtered = computed(() => data.value.resources.filter((r) => {
  if (kindFilter.value !== 'ALL' && r.kind !== kindFilter.value) return false
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  return r.name.toLowerCase().includes(q) || r.courseTitle.toLowerCase().includes(q) || r.lessonTitle.toLowerCase().includes(q)
}))

const iconOf = (k: ResourceItem['kind']) => (k === 'PDF' ? 'i-lucide-file-text' : k === 'VIDEO' ? 'i-lucide-play-circle' : 'i-lucide-headphones')
const colorOf = (_k: ResourceItem['kind']) => 'text-muted'
</script>

<template>
  <AppPage
    :title="t('panel.resources')"
    icon="i-lucide-folder-open"
  >
    <template #actions>
      <UButton
        to="/teacher/courses"
        :label="t('nav.courses')"
        icon="i-lucide-book-open"
        variant="outline"
      />
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('tp.searchResources')"
          class="w-full sm:w-80"
        />
        <USelect
          v-model="kindFilter"
          :items="[{ label: t('tp.allTypes'), value: 'ALL' }, { label: t('tp.pdfs'), value: 'PDF' }, { label: t('tp.videos'), value: 'VIDEO' }, { label: t('tp.audio'), value: 'AUDIO' }]"
          class="w-44"
        />
      </div>

      <div
        v-if="filtered.length"
        class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <UCard
          v-for="r in filtered"
          :key="r.id"
          :ui="{ body: 'p-4 flex items-start gap-3' }"
        >
          <div class="size-10 rounded-xl bg-elevated grid place-items-center shrink-0">
            <UIcon
              :name="iconOf(r.kind)"
              class="size-5"
              :class="colorOf(r.kind)"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-highlighted truncate">
              {{ r.name }}
            </p>
            <p class="text-xs text-muted truncate mt-0.5">
              {{ r.courseTitle }} · {{ r.lessonTitle }}
            </p>
            <div class="flex items-center gap-2 mt-2.5">
              <UButton
                :href="r.url"
                target="_blank"
                rel="noopener"
                :label="t('tp.open')"
                icon="i-lucide-external-link"
                size="xs"
                color="neutral"
                variant="soft"
              />
              <UButton
                :to="`/courses/manage/${r.courseId}`"
                :label="t('courses.edit')"
                size="xs"
                color="neutral"
                variant="ghost"
              />
            </div>
          </div>
        </UCard>
      </div>

      <UEmpty
        v-else
        icon="i-lucide-folder-open"
        :title="t('tp.noResources')"
        :description="t('tp.noResourcesText')"
        :actions="[{ label: t('nav.courses'), to: '/teacher/courses' }]"
      />
    </div>
  </AppPage>
</template>
