<script setup lang="ts">
import type { LmsQuestionDto, LmsQuestionGrade } from '#shared/utils/lms'

const props = defineProps<{
  question: LmsQuestionDto
  index: number
  modelValue: unknown
  grade?: LmsQuestionGrade | null
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const meta = computed(() => LMS_QUESTION_META[props.question.type] ?? LMS_QUESTION_META.SHORT_ANSWER)
const cfg = computed(() => props.question.config ?? {})

// ---- SENTENCE_BUILD ----
const sbAvailable = computed(() => {
  const pool = [...(cfg.value.words ?? [])]
  const picked = Array.isArray(props.modelValue) ? (props.modelValue as string[]) : []
  const remaining = [...pool]
  for (const w of picked) {
    const idx = remaining.indexOf(w)
    if (idx !== -1) remaining.splice(idx, 1)
  }
  return remaining
})
const sbPicked = computed(() => (Array.isArray(props.modelValue) ? (props.modelValue as string[]) : []))
function sbAdd(word: string) {
  if (props.disabled) return
  emit('update:modelValue', [...sbPicked.value, word])
}
function sbRemove(idx: number) {
  if (props.disabled) return
  const next = [...sbPicked.value]
  next.splice(idx, 1)
  emit('update:modelValue', next)
}
function sbClear() {
  if (props.disabled) return
  emit('update:modelValue', [])
}

// ---- ERROR_SPOT ----
const errorTokens = computed(() => tokenizeErrorSentence(props.question.context))
const errorVal = computed<{ index: number | null, correction: string }>(() => {
  const v = props.modelValue as { index?: number | null, correction?: string } | null
  return { index: typeof v?.index === 'number' ? v.index : null, correction: String(v?.correction ?? '') }
})
function pickErrorToken(idx: number) {
  if (props.disabled) return
  emit('update:modelValue', { index: idx, correction: errorVal.value.correction })
}
function setErrorCorrection(val: string) {
  if (props.disabled) return
  emit('update:modelValue', { index: errorVal.value.index, correction: val })
}

// ---- MCQ (multi-select) ----
const mcqSelected = computed(() => (Array.isArray(props.modelValue) ? (props.modelValue as string[]) : []))
function toggleMcq(key: string) {
  if (props.disabled) return
  const set = new Set(mcqSelected.value)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  emit('update:modelValue', [...set])
}

// ---- SINGLE_CHOICE & TRUE_FALSE ----
const strVal = computed(() => String(props.modelValue ?? ''))
function setStr(v: string) {
  if (props.disabled) return
  emit('update:modelValue', v)
}

// ---- NOTE_COMPLETION / SUMMARY_COMPLETION / SUMMARY_DRAG_DROP ----
const gapSegments = computed(() => splitByGaps(props.question.context))
const gapMap = computed<Record<string, string>>(() => (props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue) ? (props.modelValue as Record<string, string>) : {}))
function setGap(num: string, val: string) {
  if (props.disabled) return
  emit('update:modelValue', { ...gapMap.value, [num]: val })
}

// Drag & Drop + click-to-place for SUMMARY_DRAG_DROP
const activeGap = ref<string | null>(null)
const draggingKey = ref<string | null>(null)
const usedBankKeys = computed(() => new Set(Object.values(gapMap.value).filter(Boolean)))
const bankText = (key: string) => (cfg.value.wordBank ?? []).find(w => w.key === key)?.text ?? key

function assignBankWord(key: string) {
  if (props.disabled) return
  const gaps = parseGapNumbers(props.question.context)
  const target = activeGap.value || gaps.find(n => !gapMap.value[n]) || gaps[0]
  if (!target) return
  setGap(target, key)
  const nextEmpty = gaps.find(n => n !== target && !gapMap.value[n])
  activeGap.value = nextEmpty ?? null
}
function onDragStart(key: string, e: DragEvent) {
  draggingKey.value = key
  e.dataTransfer?.setData('text/plain', key)
}
function onDropGap(num: string, e: DragEvent) {
  if (props.disabled) return
  const key = e.dataTransfer?.getData('text/plain') || draggingKey.value
  if (key) setGap(num, key)
  draggingKey.value = null
}

// ---- ORDER ----
const orderItems = computed(() => {
  const source = cfg.value.items ?? []
  const ids = Array.isArray(props.modelValue) && (props.modelValue as string[]).length === source.length
    ? (props.modelValue as string[])
    : source.map(i => i.id)
  return ids.map(id => source.find(i => i.id === id)).filter((x): x is { id: string, text: string } => !!x)
})
const dragOrderIdx = ref<number | null>(null)
function moveOrder(from: number, to: number) {
  if (props.disabled) return
  const list = orderItems.value.map(i => i.id)
  if (to < 0 || to >= list.length || from === to) return
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved!)
  emit('update:modelValue', list)
}
function onDropOrder(targetIdx: number) {
  if (dragOrderIdx.value === null) return
  moveOrder(dragOrderIdx.value, targetIdx)
  dragOrderIdx.value = null
}

// ---- TRANSLATION ----
const showHint = ref(false)

// ---- DICTATION ----
const audioEl = ref<HTMLAudioElement | null>(null)
const playbackRate = ref(1)
const playCount = ref(0)
const speakingTts = ref(false)
const canPlayMore = computed(() => !cfg.value.maxPlays || playCount.value < cfg.value.maxPlays)

function playDictation() {
  if (!canPlayMore.value) return
  if (props.question.audioRef && audioEl.value) {
    audioEl.value.playbackRate = playbackRate.value
    audioEl.value.currentTime = 0
    audioEl.value.play().catch(() => {})
    playCount.value++
    return
  }
  if (import.meta.client && 'speechSynthesis' in window && cfg.value.ttsText) {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(cfg.value.ttsText)
    utter.lang = cfg.value.ttsLang || 'en-GB'
    utter.rate = playbackRate.value
    utter.onstart = () => { speakingTts.value = true }
    utter.onend = () => { speakingTts.value = false }
    utter.onerror = () => { speakingTts.value = false }
    window.speechSynthesis.speak(utter)
    playCount.value++
  }
}

const tfChoices = computed(() => [
  { label: 'True', value: 'TRUE' },
  { label: 'False', value: 'FALSE' },
  ...(cfg.value.allowNotGiven ? [{ label: 'Not Given', value: 'NOT_GIVEN' }] : [])
])
</script>

<template>
  <UCard
    :ui="{ body: 'p-4 sm:p-5 flex flex-col gap-4' }"
    :class="grade ? (grade.isCorrect ? 'ring-success/50' : 'ring-error/50') : ''"
  >
    <!-- Question Header -->
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="flex items-start gap-2.5 min-w-0 flex-1">
        <span
          class="size-7 shrink-0 rounded-full grid place-items-center text-xs font-bold"
          :class="grade ? (grade.isCorrect ? 'bg-success text-white' : 'bg-error text-white') : 'bg-primary/10 text-primary'"
        >
          {{ index + 1 }}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5 mb-1">
            <UBadge
              :label="meta.shortLabel"
              :icon="meta.icon"
              color="neutral"
              variant="subtle"
              size="xs"
            />
            <span class="text-xs text-muted">{{ question.points }} pt{{ question.points === 1 ? '' : 's' }}</span>
          </div>
          <p
            v-if="question.prompt"
            class="text-sm sm:text-base font-medium text-highlighted leading-snug"
          >
            {{ question.prompt }}
          </p>
        </div>
      </div>

      <UBadge
        v-if="grade"
        :label="`${grade.earned}/${grade.max} pt${grade.max === 1 ? '' : 's'}`"
        :color="grade.isCorrect ? 'success' : grade.earned > 0 ? 'warning' : 'error'"
        variant="soft"
        size="sm"
      />
    </div>

    <!-- Optional Question Image -->
    <img
      v-if="question.imageRef"
      :src="mediaUrl(question.imageRef)"
      alt="Question illustration"
      class="max-h-64 rounded-xl object-contain border border-default self-start"
    >

    <!-- 1. SENTENCE_BUILD -->
    <div
      v-if="question.type === 'SENTENCE_BUILD'"
      class="flex flex-col gap-3"
    >
      <div class="min-h-14 rounded-xl border-2 border-dashed border-default bg-elevated/40 p-3 flex flex-wrap items-center gap-2">
        <button
          v-for="(w, wi) in sbPicked"
          :key="`${w}-${wi}`"
          type="button"
          :disabled="disabled"
          class="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium shadow-xs hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-default"
          @click="sbRemove(wi)"
        >
          {{ w }}
        </button>
        <span
          v-if="!sbPicked.length"
          class="text-xs text-dimmed"
        >Click words below in order to build the sentence...</span>
        <UButton
          v-if="sbPicked.length && !disabled"
          icon="i-lucide-rotate-ccw"
          size="xs"
          color="neutral"
          variant="ghost"
          class="ms-auto"
          aria-label="Clear"
          @click="sbClear"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(w, wi) in sbAvailable"
          :key="`pool-${w}-${wi}`"
          type="button"
          :disabled="disabled"
          class="px-3 py-1.5 rounded-lg ring ring-default bg-default hover:bg-elevated text-sm font-medium text-highlighted transition-colors cursor-pointer disabled:opacity-50"
          @click="sbAdd(w)"
        >
          {{ w }}
        </button>
      </div>
    </div>

    <!-- 2. ERROR_SPOT -->
    <div
      v-else-if="question.type === 'ERROR_SPOT'"
      class="flex flex-col gap-3"
    >
      <div class="rounded-xl bg-elevated/50 ring ring-default p-4 flex flex-wrap gap-1.5 leading-8">
        <button
          v-for="(tok, ti) in errorTokens"
          :key="`${ti}-${tok}`"
          type="button"
          :disabled="disabled"
          class="px-2 py-0.5 rounded-lg text-base font-medium transition-all cursor-pointer"
          :class="grade?.errorSpot
            ? (ti === grade.errorSpot.expectedIndex
              ? 'bg-emerald-100 text-emerald-900 ring-2 ring-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
              : ti === errorVal.index
                ? 'bg-rose-100 text-rose-900 ring-2 ring-rose-500 dark:bg-rose-950/60 dark:text-rose-200'
                : 'text-highlighted')
            : (errorVal.index === ti
              ? 'bg-rose-500 text-white shadow-xs'
              : 'hover:bg-primary/10 text-highlighted')"
          @click="pickErrorToken(ti)"
        >
          {{ tok }}
        </button>
      </div>
      <UFormField
        v-if="cfg.requireCorrection"
        label="Write the correction"
      >
        <UInput
          :model-value="errorVal.correction"
          :disabled="disabled"
          placeholder="Type the corrected word or phrase..."
          class="w-full sm:max-w-md"
          @update:model-value="setErrorCorrection(String($event))"
        />
      </UFormField>
    </div>

    <!-- 3. MCQ (Multiple Answer) -->
    <div
      v-else-if="question.type === 'MCQ'"
      class="grid gap-2"
    >
      <button
        v-for="opt in cfg.options ?? []"
        :key="opt.key"
        type="button"
        :disabled="disabled"
        class="flex items-center gap-3 rounded-xl p-3 text-start ring transition-all cursor-pointer disabled:cursor-default"
        :class="grade
          ? ((Array.isArray(grade.expected) && grade.expected.includes(opt.key.toUpperCase()))
            ? 'ring-2 ring-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
            : mcqSelected.includes(opt.key)
              ? 'ring-2 ring-rose-500 bg-rose-50/60 dark:bg-rose-950/30'
              : 'ring-default')
          : (mcqSelected.includes(opt.key)
            ? 'ring-2 ring-primary bg-primary/5'
            : 'ring-default hover:bg-elevated/50')"
        @click="toggleMcq(opt.key)"
      >
        <span
          class="size-6 rounded-md grid place-items-center text-xs font-bold shrink-0 border"
          :class="mcqSelected.includes(opt.key) ? 'bg-primary text-white border-primary' : 'border-default text-muted'"
        >
          <UIcon
            v-if="mcqSelected.includes(opt.key)"
            name="i-lucide-check"
            class="size-3.5"
          />
          <template v-else>{{ opt.key }}</template>
        </span>
        <span class="text-sm text-highlighted flex-1">{{ opt.text }}</span>
      </button>
    </div>

    <!-- 4. SINGLE_CHOICE -->
    <div
      v-else-if="question.type === 'SINGLE_CHOICE'"
      class="grid gap-2"
    >
      <button
        v-for="opt in cfg.options ?? []"
        :key="opt.key"
        type="button"
        :disabled="disabled"
        class="flex items-center gap-3 rounded-xl p-3 text-start ring transition-all cursor-pointer disabled:cursor-default"
        :class="grade
          ? ((Array.isArray(grade.expected) && grade.expected.includes(opt.key.toUpperCase()))
            ? 'ring-2 ring-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
            : strVal === opt.key
              ? 'ring-2 ring-rose-500 bg-rose-50/60 dark:bg-rose-950/30'
              : 'ring-default')
          : (strVal === opt.key
            ? 'ring-2 ring-primary bg-primary/5'
            : 'ring-default hover:bg-elevated/50')"
        @click="setStr(opt.key)"
      >
        <span
          class="size-6 rounded-full grid place-items-center text-xs font-bold shrink-0 border"
          :class="strVal === opt.key ? 'bg-primary text-white border-primary' : 'border-default text-muted'"
        >
          {{ opt.key }}
        </span>
        <span class="text-sm text-highlighted flex-1">{{ opt.text }}</span>
      </button>
    </div>

    <!-- 5. SHORT_ANSWER -->
    <div
      v-else-if="question.type === 'SHORT_ANSWER'"
      class="flex flex-col gap-1.5"
    >
      <UInput
        :model-value="strVal"
        :disabled="disabled"
        :placeholder="cfg.placeholder || 'Type your answer...'"
        class="w-full sm:max-w-lg"
        @update:model-value="setStr(String($event))"
      />
      <p
        v-if="cfg.wordLimit"
        class="text-xs text-muted"
      >
        Maximum {{ cfg.wordLimit }} word{{ cfg.wordLimit === 1 ? '' : 's' }}
      </p>
    </div>

    <!-- 6 & 7. NOTE_COMPLETION & SUMMARY_COMPLETION -->
    <div
      v-else-if="question.type === 'NOTE_COMPLETION' || question.type === 'SUMMARY_COMPLETION'"
      class="rounded-xl bg-elevated/40 ring ring-default p-4 text-sm sm:text-base leading-9"
      :class="question.type === 'NOTE_COMPLETION' ? 'whitespace-pre-line font-normal' : ''"
    >
      <template
        v-for="(seg, si) in gapSegments"
        :key="si"
      >
        <span v-if="seg.kind === 'text'">{{ seg.value }}</span>
        <span
          v-else
          class="inline-flex items-center gap-1 mx-1 align-middle"
        >
          <span class="text-[11px] font-bold text-primary">({{ seg.number }})</span>
          <input
            type="text"
            :value="gapMap[seg.number] ?? ''"
            :disabled="disabled"
            class="w-32 sm:w-40 px-2.5 py-0.5 text-sm rounded-lg border bg-default text-highlighted focus:outline-none focus:ring-2 focus:ring-primary/50"
            :class="grade?.blanks?.[seg.number]
              ? (grade.blanks[seg.number]!.correct ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30' : 'border-rose-500 bg-rose-50/40 dark:bg-rose-950/30')
              : 'border-default'"
            :placeholder="`Gap ${seg.number}`"
            @input="setGap(seg.number, ($event.target as HTMLInputElement).value)"
          >
          <span
            v-if="grade?.blanks?.[seg.number] && !grade.blanks[seg.number]!.correct"
            class="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
          >
            [{{ grade.blanks[seg.number]!.expected.join(' / ') }}]
          </span>
        </span>
      </template>
      <p
        v-if="cfg.wordLimit"
        class="text-xs text-muted mt-2"
      >
        Write no more than {{ cfg.wordLimit }} word{{ cfg.wordLimit === 1 ? '' : 's' }} per gap.
      </p>
    </div>

    <!-- 8. SUMMARY_DRAG_DROP -->
    <div
      v-else-if="question.type === 'SUMMARY_DRAG_DROP'"
      class="flex flex-col gap-3"
    >
      <div class="rounded-xl bg-elevated/40 ring ring-default p-4 text-sm sm:text-base leading-9">
        <template
          v-for="(seg, si) in gapSegments"
          :key="si"
        >
          <span v-if="seg.kind === 'text'">{{ seg.value }}</span>
          <span
            v-else
            class="inline-flex items-center gap-1 mx-1 align-middle"
          >
            <button
              type="button"
              :disabled="disabled"
              class="min-w-24 px-2.5 py-0.5 rounded-lg border-2 border-dashed text-sm font-semibold transition-all cursor-pointer"
              :class="grade?.blanks?.[seg.number]
                ? (grade.blanks[seg.number]!.correct
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200')
                : activeGap === seg.number
                  ? 'border-primary bg-primary/10 text-primary'
                  : gapMap[seg.number]
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-default bg-default text-dimmed'"
              @click="gapMap[seg.number] ? setGap(seg.number, '') : (activeGap = seg.number)"
              @dragover.prevent
              @drop.prevent="onDropGap(seg.number, $event)"
            >
              {{ gapMap[seg.number] ? bankText(gapMap[seg.number]!) : `Gap ${seg.number}` }}
            </button>
            <span
              v-if="grade?.blanks?.[seg.number] && !grade.blanks[seg.number]!.correct"
              class="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              [{{ grade.blanks[seg.number]!.expected.map(bankText).join(' / ') }}]
            </span>
          </span>
        </template>
      </div>

      <!-- Word Bank -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="w in cfg.wordBank ?? []"
          :key="w.key"
          type="button"
          :draggable="!disabled"
          :disabled="disabled || (!cfg.reuseWords && usedBankKeys.has(w.key))"
          class="px-3 py-1.5 rounded-lg ring ring-default bg-default hover:bg-elevated text-sm font-medium text-highlighted flex items-center gap-1.5 transition-all cursor-grab active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed"
          @dragstart="onDragStart(w.key, $event)"
          @click="assignBankWord(w.key)"
        >
          <span class="text-xs font-bold text-primary">{{ w.key }}</span>
          <span>{{ w.text }}</span>
        </button>
      </div>
    </div>

    <!-- 9. TRUE_FALSE -->
    <div
      v-else-if="question.type === 'TRUE_FALSE'"
      class="flex flex-col gap-3"
    >
      <p
        v-if="question.context"
        class="rounded-xl bg-elevated/50 ring ring-default p-3.5 text-sm sm:text-base text-highlighted"
      >
        {{ question.context }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="ch in tfChoices"
          :key="ch.value"
          :label="ch.label"
          :disabled="disabled"
          :color="grade
            ? ((Array.isArray(grade.expected) && grade.expected.includes(ch.value)) ? 'success' : strVal === ch.value ? 'error' : 'neutral')
            : (strVal === ch.value ? 'primary' : 'neutral')"
          :variant="strVal === ch.value || (grade && Array.isArray(grade.expected) && grade.expected.includes(ch.value)) ? 'solid' : 'outline'"
          @click="setStr(ch.value)"
        />
      </div>
    </div>

    <!-- 10. ORDER -->
    <div
      v-else-if="question.type === 'ORDER'"
      class="flex flex-col gap-2"
    >
      <div
        v-for="(item, oi) in orderItems"
        :key="item.id"
        :draggable="!disabled"
        class="flex items-center gap-3 rounded-xl ring p-3 bg-default transition-all"
        :class="grade
          ? ((Array.isArray(grade.expected) && grade.expected[oi] === item.id) ? 'ring-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30' : 'ring-rose-400 bg-rose-50/30 dark:bg-rose-950/20')
          : 'ring-default hover:bg-elevated/40 cursor-grab'"
        @dragstart="dragOrderIdx = oi"
        @dragover.prevent
        @drop.prevent="onDropOrder(oi)"
      >
        <UIcon
          name="i-lucide-grip-vertical"
          class="size-4 text-dimmed shrink-0"
        />
        <span class="size-6 rounded-full bg-elevated text-xs font-bold grid place-items-center shrink-0">{{ oi + 1 }}</span>
        <span class="text-sm text-highlighted flex-1">{{ item.text }}</span>
        <div
          v-if="!disabled"
          class="flex items-center gap-1 shrink-0"
        >
          <UButton
            icon="i-lucide-arrow-up"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="oi === 0"
            @click="moveOrder(oi, oi - 1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="oi === orderItems.length - 1"
            @click="moveOrder(oi, oi + 1)"
          />
        </div>
      </div>
    </div>

    <!-- 11. TRANSLATION -->
    <div
      v-else-if="question.type === 'TRANSLATION'"
      class="flex flex-col gap-3"
    >
      <div class="rounded-xl bg-elevated/50 ring ring-default p-4 flex flex-col gap-2">
        <div class="flex items-center gap-2 text-xs font-semibold text-muted">
          <UBadge
            :label="cfg.sourceLang || 'Source'"
            color="neutral"
            variant="subtle"
            size="xs"
          />
          <UIcon
            name="i-lucide-arrow-right"
            class="size-3.5"
          />
          <UBadge
            :label="cfg.targetLang || 'Target'"
            color="primary"
            variant="subtle"
            size="xs"
          />
          <UButton
            v-if="cfg.hint"
            :label="showHint ? 'Hide hint' : 'Show hint'"
            size="xs"
            color="neutral"
            variant="ghost"
            class="ms-auto"
            @click="showHint = !showHint"
          />
        </div>
        <p class="text-base font-medium text-highlighted">
          {{ question.context }}
        </p>
        <p
          v-if="showHint && cfg.hint"
          class="text-xs text-primary"
        >
          Hint: {{ cfg.hint }}
        </p>
      </div>
      <UTextarea
        :model-value="strVal"
        :disabled="disabled"
        :rows="2"
        placeholder="Write your translation here..."
        class="w-full"
        @update:model-value="setStr(String($event))"
      />
    </div>

    <!-- 12. DICTATION -->
    <div
      v-else-if="question.type === 'DICTATION'"
      class="flex flex-col gap-3"
    >
      <audio
        v-if="question.audioRef"
        ref="audioEl"
        :src="mediaUrl(question.audioRef)"
        class="hidden"
      />
      <div class="flex flex-wrap items-center gap-2 rounded-xl bg-elevated/50 ring ring-default p-3">
        <UButton
          :label="speakingTts ? 'Playing...' : 'Play Audio'"
          icon="i-lucide-volume-2"
          :disabled="!canPlayMore"
          @click="playDictation"
        />
        <div class="flex items-center gap-1">
          <UButton
            v-for="r in [0.75, 1, 1.25]"
            :key="r"
            :label="`${r}x`"
            size="xs"
            :color="playbackRate === r ? 'primary' : 'neutral'"
            :variant="playbackRate === r ? 'soft' : 'ghost'"
            @click="playbackRate = r"
          />
        </div>
        <span class="ms-auto text-xs text-muted">
          Played {{ playCount }} time{{ playCount === 1 ? '' : 's' }}{{ cfg.maxPlays ? ` / ${cfg.maxPlays}` : '' }}
        </span>
      </div>

      <UTextarea
        :model-value="strVal"
        :disabled="disabled"
        :rows="2"
        placeholder="Type exactly what you hear..."
        class="w-full"
        @update:model-value="setStr(String($event))"
      />

      <!-- Word-by-word Dictation diff on review -->
      <div
        v-if="grade?.diff?.length"
        class="rounded-xl bg-elevated/60 p-3 flex flex-wrap gap-1.5 text-sm"
      >
        <span
          v-for="(d, di) in grade.diff"
          :key="di"
          class="px-1.5 py-0.5 rounded font-medium"
          :class="d.status === 'match'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
            : d.status === 'missing'
              ? 'bg-amber-100 text-amber-900 underline decoration-dotted dark:bg-amber-950/50 dark:text-amber-200'
              : 'bg-rose-100 text-rose-800 line-through dark:bg-rose-950/50 dark:text-rose-300'"
        >
          {{ d.word }}
        </span>
      </div>
    </div>

    <!-- Graded Feedback & Explanation -->
    <div
      v-if="grade"
      class="rounded-xl p-3 text-xs sm:text-sm flex flex-col gap-1"
      :class="grade.isCorrect ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200' : 'bg-rose-50/70 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200'"
    >
      <div class="flex items-center gap-1.5 font-semibold">
        <UIcon
          :name="grade.isCorrect ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
          class="size-4 shrink-0"
        />
        <span>{{ grade.isCorrect ? 'Correct!' : 'Review answer' }}</span>
      </div>
      <p
        v-if="!grade.isCorrect && Array.isArray(grade.expected) && question.type !== 'ORDER'"
        class="text-xs opacity-90"
      >
        Accepted answer: <strong class="font-semibold">{{ grade.expected.join(' / ') }}</strong>
      </p>
      <p
        v-if="!grade.isCorrect && grade.errorSpot && typeof grade.expected === 'object' && grade.expected"
        class="text-xs opacity-90"
      >
        Correction: <strong class="font-semibold">{{ ((grade.expected as any).corrections ?? []).join(' / ') }}</strong>
      </p>
      <p
        v-if="grade.explanation"
        class="text-xs opacity-90 mt-0.5"
      >
        {{ grade.explanation }}
      </p>
    </div>
  </UCard>
</template>
