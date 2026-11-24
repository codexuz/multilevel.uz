<script setup lang="ts">
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
useSeoMeta({ title: 'Courses · Teacher Panel', robots: 'noindex' })

interface TeacherCourseCard {
  id: string
  slug: string
  title: string
  summary: string | null
  exam: string | null
  level: string | null
  visibility: string
  published: boolean
  dripMode?: DripMode
  modules?: number
  lessons: number
  learners: number
}

const router = useRouter()
const toast = useToast()
const { refresh: refreshMe } = useMe()
const { data, status } = await useFetch<{ teaching: TeacherCourseCard[] }>('/api/me/courses', { default: () => ({ teaching: [] }) })

const creating = ref(false)
const saving = ref(false)
const form = reactive({
  title: '',
  summary: '',
  exam: 'NONE',
  level: 'NONE',
  visibility: 'PRIVATE' as 'PRIVATE' | 'PUBLIC',
  dripMode: 'ALWAYS_OPEN' as DripMode
})

const examItems = [{ label: 'General English', value: 'NONE' }, { label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel (CEFR)', value: 'MULTILEVEL' }]
const levelItems = [{ label: 'Any level', value: 'NONE' }, ...['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => ({ label: l, value: l }))]

async function create() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    const c = await $fetch<{ id: string }>('/api/courses', {
      method: 'POST',
      body: {
        title: form.title,
        summary: form.summary || null,
        exam: form.exam === 'NONE' ? null : form.exam,
        level: form.level === 'NONE' ? null : form.level,
        visibility: form.visibility,
        dripMode: form.dripMode
      }
    })
    creating.value = false
    await refreshMe()
    await router.push(`/courses/manage/${c.id}`)
  } catch (e) {
    toast.add({ title: 'Could not create course', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppPage
    title="My LMS Courses"
    icon="i-lucide-book-open"
  >
    <template #actions>
      <UButton
        label="New Course"
        icon="i-lucide-plus"
        @click="creating = true; form.title = ''; form.summary = ''"
      />
    </template>

    <div class="flex flex-col gap-4">
      <div
        v-if="status === 'pending' && !data.teaching.length"
        class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-44 rounded-2xl"
        />
      </div>

      <div
        v-else-if="data.teaching.length"
        class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <UCard
          v-for="c in data.teaching"
          :key="c.id"
          :ui="{ body: 'p-5 flex flex-col gap-3 h-full' }"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                :label="c.published ? 'Published' : 'Draft'"
                :color="c.published ? 'success' : 'neutral'"
                variant="subtle"
                size="xs"
              />
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
                variant="outline"
                size="xs"
              />
            </div>
            <UBadge
              :label="DRIP_MODE_META[c.dripMode ?? 'ALWAYS_OPEN'].label"
              :icon="DRIP_MODE_META[c.dripMode ?? 'ALWAYS_OPEN'].icon"
              color="info"
              variant="soft"
              size="xs"
            />
          </div>

          <div class="flex-1">
            <NuxtLink
              :to="`/courses/manage/${c.id}`"
              class="font-bold text-highlighted hover:text-primary text-base line-clamp-2"
            >
              {{ c.title }}
            </NuxtLink>
            <p
              v-if="c.summary"
              class="text-xs text-muted mt-1 line-clamp-2"
            >
              {{ c.summary }}
            </p>
          </div>

          <div class="flex items-center justify-between pt-3 border-t border-default text-xs text-muted">
            <span>{{ c.modules ?? 0 }} units · {{ c.lessons }} lessons · {{ c.learners }} learners</span>
            <div class="flex items-center gap-1">
              <UButton
                :to="`/courses/${c.slug}`"
                icon="i-lucide-eye"
                size="xs"
                color="neutral"
                variant="ghost"
              />
              <UButton
                :to="`/courses/manage/${c.id}`"
                label="Open Studio"
                size="xs"
                variant="soft"
              />
            </div>
          </div>
        </UCard>
      </div>

      <UEmpty
        v-else
        icon="i-lucide-book-open"
        title="Create your first LMS course"
        description="Build structured courses with Units/Modules, Lessons, 12-type interactive Exercises, and Content Drip scheduling."
        :actions="[{ label: 'Create Course', icon: 'i-lucide-plus', onClick: () => { creating = true } }]"
      />
    </div>

    <UModal
      v-model:open="creating"
      title="Create LMS Course"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="create"
        >
          <UFormField label="Course Title">
            <UInput
              v-model="form.title"
              placeholder="e.g. IELTS Reading & Grammar Intensive"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Summary">
            <UTextarea
              v-model="form.summary"
              :rows="2"
              placeholder="What will students master in this course?"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Track">
              <USelect
                v-model="form.exam"
                :items="examItems"
                class="w-full"
              />
            </UFormField>
            <UFormField label="CEFR Level">
              <USelect
                v-model="form.level"
                :items="levelItems"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Content Drip Policy">
            <USelect
              v-model="form.dripMode"
              :items="DRIP_MODES.map(m => ({ label: DRIP_MODE_META[m].label, value: m }))"
              class="w-full"
            />
            <p class="text-xs text-muted mt-1">
              {{ DRIP_MODE_META[form.dripMode].description }}
            </p>
          </UFormField>
          <UFormField label="Visibility">
            <URadioGroup
              v-model="form.visibility"
              :items="[
                { label: 'Private (My Groups Only)', value: 'PRIVATE' },
                { label: 'Public (Open Course Catalogue)', value: 'PUBLIC' }
              ]"
              variant="card"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="creating = false"
            />
            <UButton
              type="submit"
              label="Create & Open Builder"
              :loading="saving"
              :disabled="!form.title.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
