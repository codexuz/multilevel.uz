<script setup lang="ts">
import { uploadFile } from '~/services/http'

/**
 * The course builder's first step, what the course's page says: its title and summary, a
 * description, what learners will learn, need and are; and beside it the cover, an intro video,
 * the exam and level, and who sees it. Saved together; a bar at the bottom says when something is
 * not saved yet.
 */
export interface CourseInfo {
  id: string
  title: string
  summary: string | null
  description: string | null
  coverUrl: string | null
  introVideoUrl: string | null
  exam: string | null
  level: string | null
  visibility: string
  outcomes: string[]
  requirements: string[]
  audience: string[]
}
const props = defineProps<{ course: CourseInfo }>()
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const toast = useToast()

const snapshot = (c: CourseInfo) => ({
  title: c.title,
  summary: c.summary ?? '',
  description: c.description ?? '',
  coverUrl: c.coverUrl ?? '',
  introVideoUrl: c.introVideoUrl ?? '',
  exam: c.exam ?? 'NONE',
  level: c.level ?? 'NONE',
  visibility: c.visibility,
  outcomes: [...(c.outcomes ?? [])],
  requirements: [...(c.requirements ?? [])],
  audience: [...(c.audience ?? [])]
})
const form = reactive(snapshot(props.course))
const saved = ref(JSON.stringify(snapshot(props.course)))
watch(() => props.course, (c) => {
  Object.assign(form, snapshot(c))
  saved.value = JSON.stringify(snapshot(c))
})
const dirty = computed(() => JSON.stringify(form) !== saved.value)

const examItems = computed(() => [{ label: t('courses.anyExam'), value: 'NONE' }, { label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel (CEFR)', value: 'MULTILEVEL' }])
const levelItems = computed(() => [{ label: t('courses.anyLevel'), value: 'NONE' }, ...['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(l => ({ label: l, value: l }))])
const visibilityItems = computed(() => [
  { label: t('courses.private'), description: t('courses.privateText'), value: 'PRIVATE' },
  { label: t('courses.public'), description: t('courses.publicText'), value: 'PUBLIC' }
])
const embed = computed(() => videoEmbed(form.introVideoUrl))

// ---- the cover ----
const coverInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
async function pickCover(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    toast.add({ title: t('builder.coverType'), color: 'warning' })
    return
  }
  uploading.value = true
  try {
    form.coverUrl = (await uploadFile(file, { purpose: 'course-image' })).url
  } catch (err) {
    toast.add({ title: t('courses.notUploaded'), description: errorMessage(err), color: 'error' })
  } finally {
    uploading.value = false
    if (coverInput.value) coverInput.value.value = ''
  }
}

// ---- saving ----
const saving = ref(false)
async function save() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    await $fetch(`/api/courses/${props.course.id}`, {
      method: 'PATCH',
      body: {
        title: form.title,
        summary: form.summary,
        description: form.description,
        coverUrl: form.coverUrl || null,
        introVideoUrl: form.introVideoUrl.trim() || null,
        exam: form.exam === 'NONE' ? null : form.exam,
        level: form.level === 'NONE' ? null : form.level,
        visibility: form.visibility,
        outcomes: form.outcomes,
        requirements: form.requirements,
        audience: form.audience
      }
    })
    saved.value = JSON.stringify(form)
    toast.add({ title: t('courses.saved'), color: 'success' })
    emit('saved')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
function reset() {
  Object.assign(form, JSON.parse(saved.value))
}
defineExpose({ dirty })
</script>

<template>
  <form
    class="flex flex-col gap-6"
    data-testid="course-info"
    @submit.prevent="save"
  >
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
      <div class="flex flex-col gap-6 min-w-0">
        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              {{ t('builder.basics') }}
            </h2>
          </template>
          <div class="flex flex-col gap-5">
            <UFormField
              :label="t('courses.titleLabel')"
              required
            >
              <UInput
                v-model="form.title"
                :placeholder="t('courses.titlePlaceholder')"
                :maxlength="120"
                size="lg"
                class="w-full"
                data-testid="course-title"
              />
            </UFormField>
            <UFormField
              :label="t('courses.summary')"
              :help="t('courses.summaryHelp')"
            >
              <UTextarea
                v-model="form.summary"
                :rows="2"
                :maxlength="400"
                autoresize
                class="w-full"
              />
            </UFormField>
            <UFormField
              :label="t('builder.description')"
              :help="t('builder.descriptionHelp')"
            >
              <BuilderRichEditor
                v-model="form.description"
                toolbar="basic"
                :placeholder="t('builder.descriptionPlaceholder')"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-semibold text-highlighted">
              {{ t('builder.coursePage') }}
            </h2>
            <p class="text-sm text-muted mt-0.5">
              {{ t('builder.coursePageText') }}
            </p>
          </template>
          <div class="flex flex-col gap-6">
            <UFormField :label="t('builder.outcomes')">
              <CourseBuilderListField
                v-model="form.outcomes"
                :placeholder="t('builder.outcomesPlaceholder')"
              />
            </UFormField>
            <UFormField :label="t('builder.requirements')">
              <CourseBuilderListField
                v-model="form.requirements"
                :placeholder="t('builder.requirementsPlaceholder')"
              />
            </UFormField>
            <UFormField :label="t('builder.audience')">
              <CourseBuilderListField
                v-model="form.audience"
                :placeholder="t('builder.audiencePlaceholder')"
              />
            </UFormField>
          </div>
        </UCard>
      </div>

      <aside class="flex flex-col gap-6 lg:sticky lg:top-6">
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <div class="aspect-video bg-elevated relative overflow-hidden rounded-t-xl">
            <img
              v-if="form.coverUrl"
              :src="form.coverUrl"
              :alt="t('builder.cover')"
              class="size-full object-cover"
            >
            <div
              v-else
              class="size-full grid place-items-center text-dimmed"
            >
              <UIcon
                name="i-lucide-image"
                class="size-10"
              />
            </div>
          </div>
          <div class="p-4 flex flex-col gap-2">
            <p class="text-sm font-medium text-highlighted">
              {{ t('builder.cover') }}
            </p>
            <p class="text-xs text-muted">
              {{ t('builder.coverHelp') }}
            </p>
            <div class="flex gap-2">
              <UButton
                :label="form.coverUrl ? t('builder.coverChange') : t('builder.coverUpload')"
                icon="i-lucide-upload"
                size="sm"
                color="neutral"
                variant="outline"
                :loading="uploading"
                @click="coverInput?.click()"
              />
              <UButton
                v-if="form.coverUrl"
                :label="t('words.remove')"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="form.coverUrl = ''"
              />
            </div>
            <input
              ref="coverInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="hidden"
              @change="pickCover"
            >
          </div>
        </UCard>

        <UCard>
          <UFormField
            :label="t('builder.introVideo')"
            :help="t('courses.videoHelp')"
          >
            <UInput
              v-model="form.introVideoUrl"
              placeholder="https://www.youtube.com/watch?v=…"
              icon="i-lucide-play-circle"
              class="w-full"
            />
          </UFormField>
          <div
            v-if="embed"
            class="mt-3 aspect-video rounded-lg overflow-hidden bg-elevated"
          >
            <iframe
              :src="embed"
              class="size-full"
              :title="t('builder.introVideo')"
              allow="encrypted-media; picture-in-picture; fullscreen"
              loading="lazy"
            />
          </div>
        </UCard>

        <UCard>
          <div class="flex flex-col gap-4">
            <UFormField :label="t('courses.exam')">
              <USelect
                v-model="form.exam"
                :items="examItems"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('courses.level')">
              <USelect
                v-model="form.level"
                :items="levelItems"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('courses.whoSees')">
              <URadioGroup
                v-model="form.visibility"
                :items="visibilityItems"
                variant="card"
                size="sm"
              />
            </UFormField>
          </div>
        </UCard>
      </aside>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div
        v-if="dirty"
        class="sticky bottom-20 lg:bottom-4 z-10 self-center flex items-center gap-3 rounded-xl bg-default px-4 py-2.5 shadow-overlay"
        role="status"
      >
        <span class="text-sm text-toned">{{ t('builder.unsaved') }}</span>
        <UButton
          :label="t('builder.discard')"
          size="sm"
          color="neutral"
          variant="ghost"
          @click="reset"
        />
        <UButton
          type="submit"
          :label="t('common.save')"
          size="sm"
          :loading="saving"
          :disabled="!form.title.trim()"
          data-testid="info-save"
        />
      </div>
    </Transition>
  </form>
</template>
