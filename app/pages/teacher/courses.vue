<script setup lang="ts">
import type { CourseCard } from '~/components/course/Card.vue'

/**
 * The Teacher panel's courses: each private (for my classes' students) or public (in the catalogue),
 * a draft until published; and a new one, which opens in the course builder at its first step.
 */
definePageMeta({ middleware: 'teacher' })
const { t } = useI18n()
useSeoMeta({ title: () => t('courses.myTeaching'), robots: 'noindex' })
const router = useRouter()
const toast = useToast()
const { refresh: refreshMe } = useMe()
const { data, status } = await useFetch<{ teaching: CourseCard[] }>('/api/me/courses', { default: () => ({ teaching: [] }) })

const creating = ref(false)
const form = reactive({ title: '', visibility: 'PRIVATE' as 'PRIVATE' | 'PUBLIC' })
const saving = ref(false)
async function create() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    const c = await $fetch<{ id: string }>('/api/courses', { method: 'POST', body: { title: form.title, visibility: form.visibility } })
    await refreshMe()
    await router.push(`/courses/manage/${c.id}?tab=info`)
  } catch (e) {
    toast.add({ title: t('courses.notCreated'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
const visibilityItems = computed(() => [
  { label: t('courses.private'), description: t('courses.privateText'), value: 'PRIVATE' },
  { label: t('courses.public'), description: t('courses.publicText'), value: 'PUBLIC' }
])
</script>

<template>
  <AppPage
    :title="t('courses.myTeaching')"
    icon="i-lucide-graduation-cap"
  >
    <template #actions>
      <UButton
        to="/courses"
        :label="t('courses.browse')"
        icon="i-lucide-library"
        color="neutral"
        variant="ghost"
        class="hidden sm:inline-flex"
      />
      <UButton
        :label="t('courses.new')"
        icon="i-lucide-plus"
        data-testid="new-course"
        @click="creating = true; form.title = ''"
      />
    </template>
    <div class="flex flex-col gap-4 max-w-6xl w-full">
      <USkeleton
        v-if="status === 'pending' && !data.teaching.length"
        class="h-36 rounded-xl"
      />
      <div
        v-else-if="data.teaching.length"
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <CourseCard
          v-for="c in data.teaching"
          :key="c.id"
          :course="c"
          :to="`/courses/manage/${c.id}`"
          manage
        />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-pencil-ruler"
        :title="t('courses.firstTitle')"
        :description="t('courses.firstText')"
        :actions="[{ label: t('courses.new'), icon: 'i-lucide-plus', onClick: () => { creating = true } }]"
      />
    </div>

    <UModal
      v-model:open="creating"
      :title="t('courses.new')"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="create"
        >
          <UFormField :label="t('courses.titleLabel')">
            <UInput
              v-model="form.title"
              :placeholder="t('courses.titlePlaceholder')"
              class="w-full"
              autofocus
              data-testid="course-title"
            />
          </UFormField>
          <URadioGroup
            v-model="form.visibility"
            :items="visibilityItems"
            variant="card"
          />
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
              data-testid="course-create"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
