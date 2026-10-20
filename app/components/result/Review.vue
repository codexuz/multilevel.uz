<script setup lang="ts">
import type { ReviewSection } from '~/types/ielts'

/**
 * The marked paper, full screen, the way it was sat (pages/results/[id]/review.vue in the erp-lms
 * IELTS app): Reading with the passage beside the questions and the key's lines marked in it,
 * Listening with the recording and its transcript, Writing task by task, Speaking with the
 * recordings. A guest's result and a saved one are shown alike.
 */
const props = defineProps<{ view: ResultView, back: string }>()

export interface ResultView {
  id?: string | null
  saved?: boolean
  skill: string
  status: string
  test: { slug: string, title: string } | null
  score?: number | null
  cefrLevel?: string | null
  feedback?: string | null
  recordings?: { partId: string, audioUrl: string, durationSeconds?: number | null }[]
  review: { sections: (ReviewSection & { speaking?: any[] })[] } | null
}

const section = computed(() => props.view.review?.sections?.[0] ?? null)
const route = useRoute()
const router = useRouter()
const current = ref(Math.max(0, Number(route.query.part) || 0))
watch(current, () => router.replace({ query: { ...route.query, part: current.value ? String(current.value) : undefined } }))

const parts = computed(() => section.value?.parts ?? [])
const part = computed(() => parts.value[current.value] ?? parts.value[0] ?? null)
const tasks = computed(() => section.value?.tasks ?? [])
const task = computed(() => tasks.value[current.value] ?? tasks.value[0] ?? null)
const speaking = computed(() => section.value?.speaking ?? [])

const showKey = ref(true)
const wide = ref(true)
onMounted(() => {
  const query = window.matchMedia('(min-width: 1024px)')
  wide.value = query.matches
  query.addEventListener('change', e => (wide.value = e.matches))
})
const questionsEl = ref<HTMLElement>()
const passageEl = ref<HTMLElement>()

// ─── Listening and Reading ───
const items = computed(() => (part.value ? partItems(part.value) : []))
const correct = computed(() => items.value.filter(i => i.isCorrect).length)
const groups = computed(() => (part.value ? sortedGroups(part.value) : []))
const highlighted = computed(() => {
  if (!part.value?.passage) return null
  return showKey.value ? highlightPassage(part.value.passage, items.value) : { html: part.value.passage, found: new Set<number>() }
})
const instruction = computed(() => {
  if (!items.value.length) return undefined
  return `Questions ${items.value[0]!.number}–${items.value[items.value.length - 1]!.number} · ${correct.value} of ${items.value.length} correct`
})
const audioUrl = computed(() => mediaUrl(part.value?.audioUrl || section.value?.audioUrl) || null)
const transcriptUrl = computed(() => mediaUrl(part.value?.transcriptUrl) || null)

let pendingJump: number | null = null
function jump(n: number) {
  pendingJump = n
  nextTick(() => requestAnimationFrame(() => {
    if (pendingJump == null) return
    const q = document.getElementById(`review-question-${pendingJump}`)
    q?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    q?.animate?.([{ backgroundColor: 'color-mix(in oklab, var(--ui-primary) 25%, transparent)' }, { backgroundColor: 'transparent' }], { duration: 1200 })
    document.getElementById(`evidence-${pendingJump}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    pendingJump = null
  }))
}
watch(part, () => nextTick(() => {
  if (pendingJump != null) return
  questionsEl.value?.scrollTo({ top: 0 })
  passageEl.value?.scrollTo({ top: 0 })
}))

// ─── Writing ───
const taskTabs = computed(() => tasks.value.map((t, i) => ({ label: writingTaskLabel(t.task.taskNumber), value: i })))
const essay = computed(() => task.value?.essay ?? null)
const recordingFor = (partId: string) => props.view.recordings?.find(r => r.partId === partId) ?? null
const skillMeta = computed(() => SKILL_META[(section.value?.skill ?? 'READING') as keyof typeof SKILL_META])
</script>

<template>
  <div
    v-if="section"
    class="h-dvh flex flex-col bg-default"
  >
    <ReviewHeader
      v-model:show-key="showKey"
      :back="back"
      :title="view.test?.title ?? 'Review'"
      :hide-toggle="section.skill === 'WRITING' || section.skill === 'SPEAKING'"
    >
      <template #center>
        <UBadge
          :icon="skillMeta.icon"
          :label="skillMeta.label"
          :color="skillMeta.color"
          variant="soft"
        />
      </template>
      <template #right>
        <UBadge
          v-if="view.score != null"
          :label="`${fmtScore(view.score)} / 75 · ${view.cefrLevel ?? cefrOf(view.score)}`"
          :color="scoreColor(view.score)"
          variant="soft"
          class="max-sm:hidden tabular-nums"
        />
      </template>
    </ReviewHeader>

    <!-- Listening and Reading -->
    <template v-if="(section.skill === 'LISTENING' || section.skill === 'READING') && part">
      <ExamPartHeader
        :label="`${skillMeta.label} Part ${part.partNumber}${part.title ? ` — ${part.title}` : ''}`"
        :instruction="instruction"
      >
        <template #badges>
          <UBadge
            :label="`${correct}/${items.length}`"
            :color="items.length && correct / items.length >= 0.7 ? 'success' : correct / (items.length || 1) >= 0.5 ? 'warning' : 'error'"
            variant="subtle"
            size="sm"
            class="tabular-nums"
          />
        </template>
      </ExamPartHeader>

      <div
        v-if="section.skill === 'LISTENING' && !transcriptUrl && audioUrl"
        class="shrink-0 px-4 py-2 border-b border-default bg-muted"
      >
        <AudioPlayer
          :src="audioUrl"
          compact
        />
      </div>

      <USplitter
        v-if="(section.skill === 'READING' && part.passage) || (section.skill === 'LISTENING' && transcriptUrl)"
        :key="`${wide}:${part.id}`"
        :orientation="wide ? 'horizontal' : 'vertical'"
        :items="[{ slot: 'source', defaultSize: 50, minSize: 20 }, { slot: 'questions', defaultSize: 50, minSize: 20 }]"
        class="flex-1 min-h-0"
      >
        <template #source>
          <ReviewTranscriptPanel
            v-if="section.skill === 'LISTENING'"
            :audio-url="audioUrl"
            :transcript-url="transcriptUrl"
            :title="part.title"
          />
          <div
            v-else
            ref="passageEl"
            class="h-full overflow-y-auto px-4 md:px-6 py-4"
          >
            <p
              v-if="part.title"
              class="text-lg font-bold mb-4 text-highlighted"
            >
              {{ part.title }}
            </p>
            <div
              class="rich-content reading-passage leading-7"
              v-html="highlighted?.html"
            />
          </div>
        </template>
        <template #questions>
          <div
            ref="questionsEl"
            class="h-full overflow-y-auto px-4 md:px-6 py-4"
          >
            <div class="space-y-8 pb-6">
              <ReviewGroup
                v-for="g in groups"
                :key="g.id"
                :group="g"
                :show-key="showKey"
                :evidence-shown="highlighted?.found"
              />
            </div>
          </div>
        </template>
      </USplitter>

      <div
        v-else
        ref="questionsEl"
        class="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-4"
      >
        <div class="max-w-4xl mx-auto space-y-8 pb-6">
          <ReviewGroup
            v-for="g in groups"
            :key="g.id"
            :group="g"
            :show-key="showKey"
          />
        </div>
      </div>

      <ReviewPartNav
        v-model="current"
        :parts="parts"
        @jump="jump"
      />
    </template>

    <!-- Writing -->
    <template v-else-if="section.skill === 'WRITING' && task">
      <div class="flex-1 min-h-0 overflow-y-auto bg-muted px-3 md:px-6 lg:px-8 py-4 md:py-6">
        <div class="max-w-7xl mx-auto space-y-4">
          <div class="grid lg:grid-cols-2 gap-4">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2 flex-wrap">
                  <UIcon
                    name="i-lucide-file-text"
                    class="text-primary"
                  />
                  <span class="text-sm font-semibold">{{ writingTaskLabel(task.task.taskNumber) }}</span>
                  <UBadge
                    :label="`At least ${task.task.minWords} words`"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    class="ms-auto"
                  />
                </div>
              </template>
              <div
                class="rich-content text-sm leading-7"
                v-html="task.task.prompt"
              />
              <img
                v-if="task.task.imageUrl"
                :src="mediaUrl(task.task.imageUrl)"
                alt="The task's picture"
                class="mt-4 rounded-md border border-default w-full h-auto"
              >
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-2 flex-wrap">
                  <UIcon
                    name="i-lucide-pen-line"
                    class="text-success"
                  />
                  <span class="text-sm font-semibold">Your response</span>
                  <UBadge
                    v-if="essay"
                    :label="`${essay.wordCount} words`"
                    :color="essay.wordCount < task.task.minWords ? 'warning' : 'primary'"
                    variant="soft"
                    size="sm"
                    class="ms-auto"
                  />
                </div>
              </template>
              <p
                v-if="essay?.text"
                class="whitespace-pre-wrap leading-8 font-serif text-[15px]"
              >
                {{ essay.text }}
              </p>
              <UEmpty
                v-else
                icon="i-lucide-file-x"
                title="Nothing was written for this task"
                variant="naked"
                size="sm"
              />
              <p
                v-if="essay && essay.wordCount < task.task.minWords"
                class="mt-3 text-xs text-warning"
              >
                Under the {{ task.task.minWords }}-word minimum — an examiner marks this down.
              </p>
            </UCard>
          </div>

          <UCard v-if="essay?.feedback">
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-message-square-text"
                  class="text-warning"
                />
                <span class="text-sm font-semibold">Examiner's feedback</span>
              </div>
            </template>
            <p class="text-sm leading-7 whitespace-pre-wrap">
              {{ essay.feedback }}
            </p>
          </UCard>
        </div>
      </div>
      <div
        v-if="tasks.length > 1"
        class="shrink-0 border-t border-default bg-default px-2 py-1.5"
      >
        <UTabs
          v-model="current"
          :items="taskTabs"
          :content="false"
          class="w-full"
        />
      </div>
    </template>

    <!-- Speaking -->
    <template v-else-if="section.skill === 'SPEAKING'">
      <div class="flex-1 min-h-0 overflow-y-auto bg-muted px-3 md:px-6 py-4 md:py-6">
        <div class="max-w-3xl mx-auto space-y-4">
          <UCard
            v-for="p in speaking"
            :key="p.id"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-mic"
                  class="text-primary"
                />
                <span class="text-sm font-semibold">{{ speakingPartLabel(p.partNumber) }}<span v-if="p.title"> — {{ p.title.replace(/^Part [\d.]+\s*[—-]\s*/, '') }}</span></span>
              </div>
            </template>
            <div
              v-if="p.cueCard"
              class="rich-content text-sm mb-3"
              v-html="p.cueCard"
            />
            <ol
              v-if="p.questions?.length"
              class="list-decimal pl-5 text-sm mb-3"
            >
              <li
                v-for="q in p.questions"
                :key="q.id"
              >
                {{ q.text }}
              </li>
            </ol>
            <audio
              v-if="recordingFor(p.id)"
              :src="recordingFor(p.id)!.audioUrl"
              controls
              class="w-full"
            />
            <p
              v-else
              class="text-sm text-muted"
            >
              No recording for this part.
            </p>
          </UCard>
        </div>
      </div>
    </template>

    <div
      v-if="view.feedback"
      class="shrink-0 border-t border-default bg-default px-4 py-3"
    >
      <p class="text-sm">
        <span class="font-semibold">Examiner:</span> {{ view.feedback }}
      </p>
    </div>
  </div>
</template>
