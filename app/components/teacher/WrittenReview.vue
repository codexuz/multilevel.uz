<script setup lang="ts">
import type { LmsQuestionConfig, LmsQuestionGrade } from '#shared/utils/lms'

/**
 * The teacher's look at an exercise attempt's written responses: the task and its article or
 * picture, the student's answer, the AI's marking, and the teacher's own mark (0..100) and comment.
 */
const props = defineProps<{ attemptId: string | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

interface Written { id: string, prompt: string, context: string | null, imageRef: string | null, config: LmsQuestionConfig, points: number, answer: string, grade: LmsQuestionGrade | null }
interface AttemptView { id: string, exercise: { title: string }, student: { name: string, avatarUrl: string | null }, score: number, reviewStatus: string | null, written: Written[] }
const data = ref<AttemptView | null>(null)
const loading = ref(false)
const marks = reactive<Record<string, { score: number, comment: string }>>({})
const saving = ref<string | null>(null)

watch([open, () => props.attemptId], async ([o, id]) => {
  if (!o || !id) return
  loading.value = true
  data.value = null
  try {
    data.value = await $fetch<AttemptView>(`/api/exercise-attempts/${id}`)
    for (const w of data.value.written) marks[w.id] = { score: w.grade?.review?.score ?? 0, comment: w.grade?.review?.teacherComment ?? '' }
  } catch (e) {
    toast.add({ title: t('res.notLoaded'), description: errorMessage(e), color: 'error' })
    open.value = false
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function save(w: Written) {
  const m = marks[w.id]
  if (!m || !data.value) return
  saving.value = w.id
  try {
    const r = await $fetch<{ score: number, grade: LmsQuestionGrade }>(`/api/exercise-attempts/${data.value.id}/review`, { method: 'PATCH', body: { questionId: w.id, score: m.score, comment: m.comment } })
    w.grade = r.grade
    data.value.score = r.score
    toast.add({ title: t('res.markSaved'), description: t('res.attemptNow', { n: r.score }), color: 'success' })
    emit('saved')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = null
  }
}
const CRIT: Record<string, string> = { content: 'quiz.critContent', ownWords: 'quiz.critOwnWords', language: 'quiz.critLanguage', organisation: 'quiz.critOrganisation' }
</script>

<template>
  <UModal
    v-model:open="open"
    :title="data ? `${data.student.name} · ${data.exercise.title}` : t('res.review')"
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <USkeleton
        v-if="loading"
        class="h-64 rounded-lg"
      />
      <div
        v-else-if="data"
        class="flex flex-col gap-6"
        data-testid="written-review"
      >
        <section
          v-for="(w, i) in data.written"
          :key="w.id"
          class="flex flex-col gap-3"
        >
          <p class="font-extrabold text-highlighted">
            {{ i + 1 }}. {{ w.prompt }}
          </p>
          <details
            v-if="w.context || w.imageRef"
            class="rounded-lg ring ring-default p-2.5 text-sm"
          >
            <summary class="cursor-pointer font-bold text-muted">
              {{ w.config.mode === 'DESCRIBE_IMAGE' ? t('quiz.picture') : t('quiz.article') }}
            </summary>
            <img
              v-if="w.imageRef"
              :src="mediaUrl(w.imageRef)"
              alt=""
              class="mt-2 max-h-64 rounded-lg"
            >
            <p
              v-if="w.context"
              class="mt-2 whitespace-pre-line text-toned"
            >
              {{ w.context }}
            </p>
          </details>
          <div class="rounded-lg bg-elevated/40 p-3 text-sm whitespace-pre-line text-highlighted">
            {{ w.answer || '—' }}
            <p class="text-xs text-muted mt-2">
              {{ t('quiz.wordCount', { n: w.grade?.review?.words ?? 0 }) }}
            </p>
          </div>
          <div
            v-if="w.grade?.review?.criteria?.length"
            class="flex flex-col gap-2 text-sm"
          >
            <p class="font-bold flex items-center gap-1.5">
              <UIcon
                name="i-lucide-sparkles"
                class="size-4 text-primary"
              />{{ t('res.aiMark', { n: w.grade.review.aiScore ?? w.grade.review.score }) }}
            </p>
            <ul class="grid sm:grid-cols-2 gap-1.5">
              <li
                v-for="c in w.grade.review.criteria"
                :key="c.key"
                class="text-xs"
              >
                <strong>{{ t(CRIT[c.key] ?? c.key) }} {{ c.score }}/10</strong> · {{ c.comment }}
              </li>
            </ul>
            <p
              v-if="w.grade.review.copied?.percent"
              class="text-xs text-warning font-bold"
            >
              {{ t('quiz.copied', { n: w.grade.review.copied.percent }) }}
            </p>
            <p class="text-xs text-muted">
              {{ w.grade.review.feedback }}
            </p>
          </div>
          <p
            v-else-if="w.grade?.review?.status === 'PENDING'"
            class="text-sm text-warning font-bold"
          >
            {{ t('res.aiCouldNot') }}
          </p>
          <div
            v-if="marks[w.id]"
            class="grid sm:grid-cols-[8rem_1fr_auto] gap-2 items-end"
          >
            <UFormField :label="t('res.yourMark')">
              <UInputNumber
                v-model="marks[w.id]!.score"
                :min="0"
                :max="100"
                class="w-full"
                data-testid="review-score"
              />
            </UFormField>
            <UFormField :label="t('res.comment')">
              <UInput
                v-model="marks[w.id]!.comment"
                :placeholder="t('res.commentPlaceholder')"
                class="w-full"
              />
            </UFormField>
            <UButton
              :label="w.grade?.review?.status === 'TEACHER' ? t('res.updateMark') : t('res.saveMark')"
              icon="i-lucide-check"
              :loading="saving === w.id"
              data-testid="review-save"
              @click="save(w)"
            />
          </div>
        </section>
      </div>
    </template>
  </UModal>
</template>
