<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('nav.courses'), robots: 'noindex' })

interface AdminCourseRow {
  id: string
  slug: string
  title: string
  summary: string | null
  exam: string | null
  level: string | null
  visibility: string
  published: boolean
  dripMode: DripMode
  modules: number
  lessons: number
  exercises: number
  learners: number
  teacher: { id: string, name: string, avatarUrl: string | null } | null
  updatedAt: string
}

const router = useRouter()
const toast = useToast()
const search = ref('')
const { data, status, refresh } = await useFetch<{ courses: AdminCourseRow[] }>('/api/admin/courses', {
  default: () => ({ courses: [] })
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return data.value.courses
  return data.value.courses.filter(c =>
    c.title.toLowerCase().includes(q)
    || (c.teacher?.name ?? '').toLowerCase().includes(q)
    || (c.level ?? '').toLowerCase().includes(q)
  )
})

const creating = ref(false)
const saving = ref(false)
const form = reactive({ title: '', visibility: 'PUBLIC' as 'PRIVATE' | 'PUBLIC', dripMode: 'ALWAYS_OPEN' as DripMode })

async function createCourse() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    const c = await $fetch<{ id: string }>('/api/courses', { method: 'POST', body: form })
    creating.value = false
    await router.push(`/courses/manage/${c.id}?panel=admin`)
  } catch (e) {
    toast.add({ title: t('courses.notCreated'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function removeCourse(c: AdminCourseRow) {
  if (!confirm(t('courses.deleteSure', { title: c.title }))) return
  try {
    await $fetch(`/api/courses/${c.id}`, { method: 'DELETE' })
    toast.add({ title: t('acourses.deleted'), color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    :title="t('nav.courses')"
    icon="i-lucide-book-open"
  >
    <template #actions>
      <UButton
        :label="t('courses.new')"
        icon="i-lucide-plus"
        @click="creating = true; form.title = ''"
      />
    </template>

    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('acourses.search')"
          class="w-full sm:w-80"
        />
        <span class="text-xs text-muted">{{ filtered.length }} course(s)</span>
      </div>

      <UCard :ui="{ body: 'p-0' }">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs font-semibold text-muted">
                <th class="px-4 py-3">
                  {{ t('acourses.course') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('acourses.teacher') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('acourses.structure') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('builder.release') }}
                </th>
                <th class="px-4 py-3">
                  {{ t('tp.status') }}
                </th>
                <th class="px-4 py-3 text-right">
                  {{ t('acourses.actions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default/60">
              <tr v-if="status === 'pending' && !filtered.length">
                <td
                  colspan="6"
                  class="p-6"
                >
                  <USkeleton class="h-12 w-full rounded-lg" />
                </td>
              </tr>
              <tr
                v-for="c in filtered"
                :key="c.id"
                class="hover:bg-elevated/40 transition-colors"
              >
                <td class="px-4 py-3">
                  <NuxtLink
                    :to="`/courses/manage/${c.id}?panel=admin`"
                    class="font-semibold text-highlighted hover:text-primary block"
                  >
                    {{ c.title }}
                  </NuxtLink>
                  <div class="flex items-center gap-1.5 mt-1">
                    <UBadge
                      v-if="c.exam"
                      :label="c.exam"
                      color="primary"
                      variant="subtle"
                      size="xs"
                    />
                    <UBadge
                      v-if="c.level"
                      :label="c.level"
                      color="neutral"
                      variant="subtle"
                      size="xs"
                    />
                    <UBadge
                      :label="c.visibility"
                      color="neutral"
                      variant="outline"
                      size="xs"
                    />
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <UAvatar
                      :src="c.teacher?.avatarUrl ?? undefined"
                      :alt="c.teacher?.name ?? t('panel.teacher')"
                      size="xs"
                    />
                    <span class="text-toned">{{ c.teacher?.name ?? t('panel.teacher') }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-xs text-muted tabular-nums">
                  {{ c.modules }} units · {{ c.lessons }} lessons · {{ c.exercises }} exercises · {{ c.learners }} learners
                </td>
                <td class="px-4 py-3">
                  <UBadge
                    :label="t(`builder.drip.${c.dripMode}`)"
                    :icon="DRIP_MODE_META[c.dripMode]?.icon"
                    color="info"
                    variant="soft"
                    size="xs"
                  />
                </td>
                <td class="px-4 py-3">
                  <UBadge
                    :label="c.published ? t('builder.published') : t('courses.draft')"
                    :color="c.published ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                  />
                </td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <div class="inline-flex items-center gap-1">
                    <UButton
                      :to="`/courses/manage/${c.id}?panel=admin`"
                      :label="t('acourses.builder')"
                      icon="i-lucide-pencil-ruler"
                      size="xs"
                      variant="soft"
                    />
                    <UButton
                      :to="`/courses/${c.slug}`"
                      icon="i-lucide-eye"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('builder.preview')"
                    />
                    <UButton
                      icon="i-lucide-trash-2"
                      size="xs"
                      color="error"
                      variant="ghost"
                      :aria-label="t('builder.delete')"
                      @click="removeCourse(c)"
                    />
                  </div>
                </td>
              </tr>
              <tr v-if="!filtered.length && status !== 'pending'">
                <td
                  colspan="6"
                  class="py-10 text-center text-muted"
                >
                  {{ t('acourses.none') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="creating"
      :title="t('courses.new')"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="createCourse"
        >
          <UFormField :label="t('courses.titleLabel')">
            <UInput
              v-model="form.title"
              placeholder="e.g. B2 Multilevel Complete Mastery"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField :label="t('courses.whoSees')">
            <USelect
              v-model="form.visibility"
              :items="[{ label: t('courses.public'), value: 'PUBLIC' }, { label: t('courses.private'), value: 'PRIVATE' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('builder.release')">
            <USelect
              v-model="form.dripMode"
              :items="DRIP_MODES.map(m => ({ label: t(`builder.drip.${m}`), value: m }))"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="creating = false"
            />
            <UButton
              type="submit"
              :label="t('builder.createCourse')"
              :loading="saving"
              :disabled="!form.title.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
