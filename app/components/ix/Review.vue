<script setup lang="ts">
import type { ResultView } from '~/components/result/Review.vue'
import type { ReviewNavPart } from '~/composables/useReviewMarks'
import type { AnswerMap } from '~/types/exam'
import type { QuestionItem } from '~/types/ielts'

/**
 * An IELTS paper reviewed on the test's own screen (the erp-lms IELTS app's review): the bar along
 * the top, the rubric, the passage (or the recording and its transcript) beside the questions with
 * the ⟷ handle between, and the parts along the bottom. Each answer is where it was given, green for
 * a mark and red for none; while the key is shown, the right answers, why, and the lines of the text
 * they come from. Writing shows each task beside the response, with the examiner's word under it.
 */
const props = defineProps<{ view: ResultView & { band?: number | null }, back: string }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { me } = useMe()

const theme = provideIxTheme()
const section = computed(() => props.view.review?.sections?.[0] ?? null)
const skill = computed(() => section.value?.skill ?? props.view.skill)
const candidate = computed(() => me.value?.name || accountHandle(me.value) || '')

const current = ref(Math.max(0, Number(route.query.part) || 0))
watch(current, () => router.replace({ query: { ...route.query, part: current.value ? String(current.value) : undefined } }))
const parts = computed(() => section.value?.parts ?? [])
const part = computed(() => parts.value[current.value] ?? parts.value[0] ?? null)
const tasks = computed(() => section.value?.tasks ?? [])
const task = computed(() => tasks.value[current.value] ?? tasks.value[0] ?? null)

const showKey = ref(true)

// ─── Listening and Reading ───
const items = computed(() => (part.value ? partItems(part.value) : []))
const byNumber = computed(() => new Map(parts.value.flatMap(partItems).map(i => [i.number, i] as [number, QuestionItem])))
const answers = computed<AnswerMap>(() => Object.fromEntries(items.value.filter(answered).map(i => [i.number, String(i.answer)])))
provide(REVIEW_MARKS, {
  correct: n => !!byNumber.value.get(n)?.isCorrect,
  keys: n => byNumber.value.get(n)?.acceptedAnswers ?? [],
  showKey
})

const correct = computed(() => items.value.filter(i => i.isCorrect).length)
const groups = computed(() => (part.value ? sortedGroups(part.value) : []))
const highlighted = computed(() => {
  if (!part.value?.passage) return null
  return showKey.value ? highlightPassage(part.value.passage, items.value) : { html: part.value.passage, found: new Set<number>() }
})
// The heading gaps go above their paragraphs, as in the test.
const passage = computed(() => (highlighted.value ? insertHeadingSlots(highlighted.value.html, groups.value.map(toRenderQuestion)) : ''))
const rubric = computed(() => {
  if (!items.value.length) return undefined
  const first = items.value[0]!.number
  const last = items.value[items.value.length - 1]!.number
  return t(skill.value === 'LISTENING' ? 'ixReview.rubricListening' : 'ixReview.rubricReading', { from: first, to: last, correct: correct.value, total: items.value.length })
})
const audioUrl = computed(() => mediaUrl(part.value?.audioUrl || section.value?.audioUrl) || null)
const transcriptUrl = computed(() => mediaUrl(part.value?.transcriptUrl) || null)
const split = computed(() => (skill.value === 'READING' && !!part.value?.passage) || (skill.value === 'LISTENING' && !!transcriptUrl.value))

// The question picked in the bar is boxed in blue, as in the test.
const focused = ref<number | null>(null)
provide(QUESTION_FOCUS, { current: focused, focus: (n) => { focused.value = n } })

/** A question picked in the part bar: bring it, and its line in the passage, into view. */
function jump(n: number) {
  focused.value = n
  nextTick(() => requestAnimationFrame(() => {
    document.getElementById(`question-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    document.getElementById(`evidence-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }))
}
watch(part, () => {
  focused.value = null
  nextTick(() => document.querySelectorAll('.ix-pane, .ix-single').forEach(p => p.scrollTo({ top: 0 })))
})

const navParts = computed<ReviewNavPart[]>(() => {
  if (skill.value === 'WRITING') {
    return tasks.value.map(tk => ({
      id: tk.task.id,
      label: writingTaskLabel(tk.task.taskNumber, 'IELTS'),
      done: !!tk.essay?.text,
      count: tk.essay?.text ? t('common.words', { n: tk.essay.wordCount }, tk.essay.wordCount) : t('ixReview.notAnswered')
    }))
  }
  return parts.value.map(p => ({
    id: p.id,
    label: t('part.part', { n: p.partNumber }),
    questions: partItems(p).map(i => ({ n: i.number, correct: !!i.isCorrect, answered: answered(i) }))
  }))
})

// ─── Writing ───
const essay = computed(() => task.value?.essay ?? null)
const band = computed(() => props.view.band ?? section.value?.band ?? null)
</script>

<template>
  <div
    v-if="section"
    class="ix"
    :class="{ 'is-dark': theme.isDark.value }"
    :style="theme.style.value"
    data-testid="review"
  >
    <div class="ix-main">
      <IxReviewHeader
        v-model:show-key="showKey"
        :back="back"
        :title="view.test?.title"
        :candidate="candidate"
        :hide-toggle="skill === 'WRITING'"
      >
        <template #right>
          <span
            v-if="band != null"
            class="ix-band"
            data-testid="band"
          >
            {{ section.estimated ? t('ixReview.estBand') : t('result.band') }} <strong>{{ fmtBand(band) }}</strong>
          </span>
          <span
            v-else-if="section.total"
            class="ix-band"
          >
            <strong>{{ section.correct ?? 0 }}</strong>/{{ section.total }}
          </span>
        </template>
      </IxReviewHeader>

      <!-- Listening and Reading -->
      <template v-if="skill !== 'WRITING' && part">
        <IxPartHeader
          :label="t('part.part', { n: part.partNumber })"
          :instruction="rubric"
        />

        <!-- Listening without a transcript: the recording along the top -->
        <div
          v-if="skill === 'LISTENING' && !transcriptUrl && audioUrl"
          class="ix-audio"
        >
          <AudioPlayer
            :src="audioUrl"
            compact
          />
        </div>

        <div class="ix-body">
          <IxSplitPane
            v-if="split"
            :key="part.id"
            :labels="[skill === 'LISTENING' ? t('ixReview.transcript') : t('ixReview.passage'), t('ixReview.questions')]"
          >
            <template #left>
              <IxReviewTranscriptPanel
                v-if="skill === 'LISTENING'"
                :audio-url="audioUrl"
                :transcript-url="transcriptUrl"
                :title="part.title"
              />
              <div v-else>
                <h2
                  v-if="part.title"
                  class="ix-passage-title"
                >
                  {{ part.title }}
                </h2>
                <div
                  class="ix-passage"
                  v-html="passage"
                />
              </div>
            </template>
            <template #right>
              <div class="ix-questions">
                <IxReviewGroup
                  v-for="g in groups"
                  :key="g.id"
                  :group="g"
                  :answers="answers"
                  :show-key="showKey"
                  :evidence-shown="highlighted?.found"
                />
              </div>
            </template>
          </IxSplitPane>
          <div
            v-else
            :key="part.id"
            class="ix-single"
          >
            <div class="ix-questions">
              <IxReviewGroup
                v-for="g in groups"
                :key="g.id"
                :group="g"
                :answers="answers"
                :show-key="showKey"
              />
            </div>
          </div>
        </div>
      </template>

      <!-- Writing -->
      <template v-else-if="skill === 'WRITING' && task">
        <IxPartHeader
          :label="writingTaskLabel(task.task.taskNumber, 'IELTS')"
          :instruction="t('ixReview.writingRubric', { minutes: task.task.suggestedMinutes ?? writingDefaults(task.task.taskNumber, 'IELTS').minutes, words: task.task.minWords })"
        />
        <div class="ix-body">
          <IxSplitPane
            :key="task.task.id"
            :labels="[t('ixReview.task'), t('ixReview.response')]"
          >
            <template #left>
              <div
                class="ix-task"
                v-html="task.task.prompt"
              />
              <img
                v-if="task.task.imageUrl"
                :src="mediaUrl(task.task.imageUrl)"
                alt=""
                class="ix-image"
              >
            </template>
            <template #right>
              <div
                class="ix-response"
                data-testid="response"
              >
                <template v-if="essay?.text">
                  {{ essay.text }}
                </template>
                <span
                  v-else
                  class="ix-response-empty"
                >{{ t('ixReview.nothingWritten') }}</span>
              </div>
              <p
                v-if="essay"
                class="ix-words"
                :class="{ 'is-short': essay.wordCount < task.task.minWords }"
              >
                {{ t('ixReview.words', { n: essay.wordCount }) }}<template v-if="essay.wordCount < task.task.minWords">
                  — {{ t('ixReview.underMin', { n: task.task.minWords }) }}
                </template>
              </p>

              <section
                v-if="essay?.feedback"
                class="ix-marks"
              >
                <h3 class="ix-qhead">
                  {{ t('ixReview.examinerFeedback') }}
                </h3>
                <p class="ix-feedback">
                  {{ essay.feedback }}
                </p>
              </section>
              <p
                v-else-if="view.status !== 'GRADED'"
                class="ix-why"
              >
                {{ t('ixReview.notMarked') }}
              </p>
              <section
                v-if="view.feedback && current === 0"
                class="ix-marks"
              >
                <h3 class="ix-qhead">
                  {{ t('ixReview.overallFeedback') }}
                </h3>
                <p class="ix-feedback">
                  {{ view.feedback }}
                </p>
              </section>
            </template>
          </IxSplitPane>
        </div>
      </template>

      <IxReviewPartNav
        v-model="current"
        :parts="navParts"
        @jump="jump"
      />
    </div>
  </div>
</template>
