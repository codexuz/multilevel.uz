<script setup lang="ts">
import type { LmsAcceptedAnswers, LmsOptionItem, LmsOrderItem, LmsQuestionConfig, LmsQuestionDto, LmsQuestionType, WrittenMode } from '#shared/utils/lms'
import { uploadFile } from '~/services/http'

const props = defineProps<{
  exerciseId: string
  question: LmsQuestionDto | null
  initialType?: LmsQuestionType
}>()

const emit = defineEmits<{ saved: [], close: [] }>()
const { t } = useI18n()
const toast = useToast()

const initialType: LmsQuestionType = props.question?.type ?? props.initialType ?? 'SINGLE_CHOICE'
const template = defaultQuestionTemplate(initialType)

const type = ref<LmsQuestionType>(initialType)
const prompt = ref(props.question?.prompt ?? template.prompt)
const context = ref(props.question?.context ?? template.context ?? '')
const audioRef = ref(props.question?.audioRef ?? '')
const imageRef = ref(props.question?.imageRef ?? '')
const explanation = ref(props.question?.explanation ?? '')
const points = ref(props.question?.points ?? 1)

// Per-type editable state
const initCfg = (props.question?.config ?? template.config) as LmsQuestionConfig
const initAcc = (props.question?.acceptedAnswers ?? template.acceptedAnswers) as LmsAcceptedAnswers

// SENTENCE_BUILD
const sbSentence = ref((initCfg.words ?? []).join(' '))
const sbDistractors = ref((initCfg.distractors ?? []).join(', '))
const sbAltAnswers = ref(Array.isArray(initAcc) ? initAcc.join('\n') : '')

// ERROR_SPOT
const esErrorIndex = ref(Number.isInteger(initCfg.errorIndex) ? Number(initCfg.errorIndex) : 0)
const esRequireCorrection = ref(initCfg.requireCorrection ?? true)
const esCorrections = ref(Array.isArray(initAcc) ? initAcc.join(' / ') : '')
const esTokens = computed(() => tokenizeErrorSentence(context.value))

// MCQ & SINGLE_CHOICE
const options = ref<LmsOptionItem[]>(
  initCfg.options?.length
    ? structuredClone(initCfg.options)
    : [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
)
const selectedCorrectKeys = ref<string[]>(Array.isArray(initAcc) ? initAcc.map(x => String(x).toUpperCase()) : ['A'])

// SHORT_ANSWER / TRANSLATION
const wordLimit = ref<number | undefined>(initCfg.wordLimit ?? undefined)
const placeholder = ref(initCfg.placeholder ?? '')
const textAnswers = ref(Array.isArray(initAcc) ? initAcc.join('\n') : '')
const sourceLang = ref(initCfg.sourceLang ?? 'UZ')
const targetLang = ref(initCfg.targetLang ?? 'EN')
const hint = ref(initCfg.hint ?? '')

// TRUE_FALSE
const allowNotGiven = ref(!!initCfg.allowNotGiven)
const tfAnswer = ref(Array.isArray(initAcc) && initAcc[0] ? String(initAcc[0]).toUpperCase() : 'TRUE')

// NOTE_COMPLETION / SUMMARY_COMPLETION / SUMMARY_DRAG_DROP
const gapNumbers = computed(() => parseGapNumbers(context.value))
const gapAnswers = ref<Record<string, string>>(
  initAcc && !Array.isArray(initAcc)
    ? Object.fromEntries(Object.entries(initAcc).map(([k, v]) => [k, Array.isArray(v) ? v.join(' / ') : String(v ?? '')]))
    : {}
)
const wordBank = ref<LmsOptionItem[]>(
  initCfg.wordBank?.length
    ? structuredClone(initCfg.wordBank)
    : [{ key: 'A', text: '' }, { key: 'B', text: '' }, { key: 'C', text: '' }, { key: 'D', text: '' }]
)
const reuseWords = ref(!!initCfg.reuseWords)

// ORDER
const orderItems = ref<LmsOrderItem[]>(
  initCfg.items?.length
    ? structuredClone(initCfg.items)
    : [{ id: 'step-1', text: '' }, { id: 'step-2', text: '' }, { id: 'step-3', text: '' }]
)

// DICTATION
const ttsText = ref(initCfg.ttsText ?? (Array.isArray(initAcc) ? initAcc[0] ?? '' : ''))
const ttsLang = ref(initCfg.ttsLang ?? 'en-GB')
const maxPlays = ref<number | undefined>(initCfg.maxPlays ?? undefined)

// DICTATION from a recording or YouTube, in timed segments (each segment's text is its accepted answer)
interface EditSegment { id: string, start: number, end: number, text: string }
const dictSource = ref<'TTS' | 'FILE' | 'YOUTUBE'>(initCfg.youtubeUrl ? 'YOUTUBE' : (initCfg.segments?.length || (props.question?.type === 'DICTATION' && props.question.audioRef && isVideoFile(props.question.audioRef))) ? 'FILE' : 'TTS')
const youtubeUrl = ref(initCfg.youtubeUrl ?? '')
const audioOnly = ref(!!initCfg.audioOnly)
const segMap = initAcc && !Array.isArray(initAcc) ? initAcc : {}
const segments = ref<EditSegment[]>((initCfg.segments ?? []).map(sg => ({ ...sg, text: (segMap[sg.id] ?? [])[0] ?? '' })))
const media = ref<{ play: (a: number, b: number, r?: number) => Promise<void>, stop: () => void, currentTime: () => number } | null>(null)
const newSegId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
/** Seconds as m:ss.s */
const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60)
  const rest = sec - m * 60
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`
}
/** "1:10", "01:10.5", "0:01:10" or "70" as seconds; null if not a time. */
function parseTime(v: string): number | null {
  const parts = v.trim().split(':').map(x => x.trim())
  if (!parts.length || parts.some(x => !/^\d+(\.\d+)?$/.test(x))) return null
  return Math.round(parts.reduce((acc, x) => acc * 60 + Number(x), 0) * 10) / 10
}
function setTime(seg: EditSegment, which: 'start' | 'end', v: string) {
  const t2 = parseTime(v)
  if (t2 != null) seg[which] = t2
}
function markNow(seg: EditSegment, which: 'start' | 'end') {
  if (media.value) seg[which] = Math.round(media.value.currentTime() * 10) / 10
}
function addSegment() {
  const last = segments.value.at(-1)
  const start = last ? last.end : 0
  segments.value.push({ id: newSegId(), start, end: start + 5, text: '' })
}
const previewing = ref<string | null>(null)
function preview(seg: EditSegment) {
  previewing.value = seg.id
  media.value?.play(seg.start, seg.end)
}
const pasteOpen = ref(false)
const pasteText = ref('')
/** Lines like "00:01-01:10 The text" (or "00:01 - 01:10 | The text") become segments. */
const pasted = computed(() => pasteText.value.split('\n').map((line) => {
  const m = /^\s*([\d:.]+)\s*[-–—]\s*([\d:.]+)\s*[|:\-–—]?\s*(.*)$/.exec(line)
  if (!m) return null
  const start = parseTime(m[1]!)
  const end = parseTime(m[2]!)
  return start != null && end != null && end > start ? { id: newSegId(), start, end, text: m[3]!.trim() } : null
}).filter((x): x is EditSegment => !!x))
function applyPaste() {
  if (!pasted.value.length) return
  segments.value = pasted.value
  pasteOpen.value = false
  pasteText.value = ''
}
const splitting = ref(false)
const { confirm } = useDialogs()
async function autoSplit() {
  if (!audioRef.value) return
  if (segments.value.length && !await confirm({ title: t('qe.splitReplace'), confirmLabel: t('qe.autoSplit'), color: 'warning' })) return
  splitting.value = true
  try {
    const r = await $fetch<{ segments: { start: number, end: number, text: string }[] }>('/api/course-questions/dictation-segments', { method: 'POST', body: { ref: audioRef.value } })
    segments.value = r.segments.map(sg => ({ ...sg, id: newSegId() }))
    toast.add({ title: t('qe.splitDone', { n: r.segments.length }), color: 'success' })
  } catch (e) {
    toast.add({ title: t('qe.splitFailed'), description: errorMessage(e), color: 'error' })
  } finally {
    splitting.value = false
  }
}
const uploadingMedia = ref(false)
async function onUploadMedia(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingMedia.value = true
  try {
    const up = await uploadFile(file, { purpose: 'course-media' })
    audioRef.value = up.url
    toast.add({ title: t('qe.audioUploaded'), color: 'success' })
  } catch (err) {
    toast.add({ title: t('courses.notUploaded'), description: errorMessage(err), color: 'error' })
  } finally {
    uploadingMedia.value = false
  }
}

// WRITTEN_RESPONSE
const wrMode = ref<WrittenMode>(initCfg.mode ?? 'SUMMARY')
const wrMin = ref<number | undefined>(initCfg.minWords ?? undefined)
const wrMax = ref<number | undefined>(initCfg.maxWords ?? undefined)
const wrKeyPoints = ref((initCfg.keyPoints ?? []).join('\n'))
const wrModel = ref(initCfg.modelAnswer ?? '')
const drafting = ref(false)
async function draftKeys() {
  drafting.value = true
  try {
    const r = await $fetch<{ keyPoints: string[], modelAnswer: string }>('/api/course-questions/written-draft', {
      method: 'POST',
      body: { mode: wrMode.value, prompt: prompt.value, context: context.value || null, imageRef: imageRef.value || null, minWords: wrMin.value ?? null, maxWords: wrMax.value ?? null }
    })
    wrKeyPoints.value = r.keyPoints.join('\n')
    wrModel.value = r.modelAnswer
  } catch (e) {
    toast.add({ title: t('qe.draftFailed'), description: errorMessage(e), color: 'error' })
  } finally {
    drafting.value = false
  }
}

function switchType(nextType: LmsQuestionType) {
  type.value = nextType
  if (props.question) return
  const tpl = defaultQuestionTemplate(nextType)
  prompt.value = tpl.prompt
  context.value = tpl.context ?? ''
  const c = tpl.config
  const a = tpl.acceptedAnswers
  if (nextType === 'SENTENCE_BUILD') {
    sbSentence.value = (c.words ?? []).join(' ')
    sbDistractors.value = ''
    sbAltAnswers.value = Array.isArray(a) ? a.join('\n') : ''
  } else if (nextType === 'ERROR_SPOT') {
    esErrorIndex.value = c.errorIndex ?? 0
    esRequireCorrection.value = !!c.requireCorrection
    esCorrections.value = Array.isArray(a) ? a.join(' / ') : ''
  } else if (nextType === 'MCQ' || nextType === 'SINGLE_CHOICE') {
    options.value = structuredClone(c.options ?? [])
    selectedCorrectKeys.value = Array.isArray(a) ? [...a] : ['A']
  } else if (nextType === 'NOTE_COMPLETION' || nextType === 'SUMMARY_COMPLETION' || nextType === 'SUMMARY_DRAG_DROP') {
    gapAnswers.value = a && !Array.isArray(a) ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.join(' / ')])) : {}
    if (c.wordBank) wordBank.value = structuredClone(c.wordBank)
  } else if (nextType === 'TRUE_FALSE') {
    allowNotGiven.value = !!c.allowNotGiven
    tfAnswer.value = Array.isArray(a) ? (a[0] ?? 'TRUE') : 'TRUE'
  } else if (nextType === 'ORDER') {
    orderItems.value = structuredClone(c.items ?? [])
  } else if (nextType === 'TRANSLATION' || nextType === 'SHORT_ANSWER') {
    textAnswers.value = Array.isArray(a) ? a.join('\n') : ''
    sourceLang.value = c.sourceLang ?? 'UZ'
    targetLang.value = c.targetLang ?? 'EN'
    hint.value = c.hint ?? ''
    wordLimit.value = c.wordLimit ?? undefined
  } else if (nextType === 'DICTATION') {
    ttsText.value = c.ttsText ?? ''
    textAnswers.value = Array.isArray(a) ? a.join('\n') : ''
  }
}

function addOption() {
  const nextChar = String.fromCharCode(65 + options.value.length)
  options.value.push({ key: nextChar, text: '' })
}
function removeOption(idx: number) {
  const removed = options.value.splice(idx, 1)[0]
  if (removed) selectedCorrectKeys.value = selectedCorrectKeys.value.filter(k => k !== removed.key)
}
function toggleCorrectKey(key: string) {
  if (type.value === 'SINGLE_CHOICE') {
    selectedCorrectKeys.value = [key]
    return
  }
  if (selectedCorrectKeys.value.includes(key)) selectedCorrectKeys.value = selectedCorrectKeys.value.filter(k => k !== key)
  else selectedCorrectKeys.value = [...selectedCorrectKeys.value, key]
}

function insertNextGap() {
  const nums = gapNumbers.value.map(Number)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  context.value = `${context.value}${context.value && !context.value.endsWith(' ') ? ' ' : ''}{{${next}}}`
}
function addBankWord() {
  const nextChar = String.fromCharCode(65 + wordBank.value.length)
  wordBank.value.push({ key: nextChar, text: '' })
}
function addOrderItem() {
  orderItems.value.push({ id: `step-${Date.now().toString(36)}`, text: '' })
}
function moveOrder(idx: number, delta: -1 | 1) {
  const j = idx + delta
  if (j < 0 || j >= orderItems.value.length) return
  ;[orderItems.value[idx], orderItems.value[j]] = [orderItems.value[j]!, orderItems.value[idx]!]
}

// Media uploads
const uploadingAudio = ref(false)
const uploadingImage = ref(false)
async function onUploadAudio(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingAudio.value = true
  try {
    const up = await uploadFile(file, { purpose: 'course-audio' })
    audioRef.value = up.url
    toast.add({ title: t('qe.audioUploaded'), color: 'success' })
  } catch (err) {
    toast.add({ title: t('courses.notUploaded'), description: errorMessage(err), color: 'error' })
  } finally {
    uploadingAudio.value = false
  }
}
async function onUploadImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingImage.value = true
  try {
    const up = await uploadFile(file, { purpose: 'course-image' })
    imageRef.value = up.url
    toast.add({ title: t('qe.imageUploaded'), color: 'success' })
  } catch (err) {
    toast.add({ title: t('courses.notUploaded'), description: errorMessage(err), color: 'error' })
  } finally {
    uploadingImage.value = false
  }
}

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    let config: LmsQuestionConfig = {}
    let acceptedAnswers: LmsAcceptedAnswers = []
    let ctx: string | null = context.value.trim() || null

    if (type.value === 'SENTENCE_BUILD') {
      const words = sbSentence.value.trim().split(/\s+/).filter(Boolean)
      const distractors = sbDistractors.value.split(',').map(s => s.trim()).filter(Boolean)
      const alts = sbAltAnswers.value.split('\n').map(s => s.trim()).filter(Boolean)
      config = { words, distractors }
      acceptedAnswers = alts.length ? alts : (words.length ? [words.join(' ')] : [])
      ctx = null
    } else if (type.value === 'ERROR_SPOT') {
      config = { errorIndex: esErrorIndex.value, requireCorrection: esRequireCorrection.value }
      acceptedAnswers = esCorrections.value.split('/').map(s => s.trim()).filter(Boolean)
    } else if (type.value === 'MCQ' || type.value === 'SINGLE_CHOICE') {
      const cleanOpts = options.value.filter(o => o.text.trim())
      config = { options: cleanOpts }
      acceptedAnswers = selectedCorrectKeys.value.filter(k => cleanOpts.some(o => o.key === k))
      ctx = null
    } else if (type.value === 'SHORT_ANSWER') {
      config = { wordLimit: wordLimit.value || null, placeholder: placeholder.value || undefined }
      acceptedAnswers = textAnswers.value.split('\n').map(s => s.trim()).filter(Boolean)
    } else if (type.value === 'NOTE_COMPLETION' || type.value === 'SUMMARY_COMPLETION') {
      config = { wordLimit: wordLimit.value || null }
      const map: Record<string, string[]> = {}
      for (const n of gapNumbers.value) {
        map[n] = String(gapAnswers.value[n] ?? '').split('/').map(s => s.trim()).filter(Boolean)
      }
      acceptedAnswers = map
    } else if (type.value === 'SUMMARY_DRAG_DROP') {
      const bank = wordBank.value.filter(w => w.text.trim())
      config = { wordBank: bank, reuseWords: reuseWords.value }
      const map: Record<string, string[]> = {}
      for (const n of gapNumbers.value) {
        const val = String(gapAnswers.value[n] ?? '').trim()
        map[n] = val ? [val] : []
      }
      acceptedAnswers = map
    } else if (type.value === 'TRUE_FALSE') {
      config = { allowNotGiven: allowNotGiven.value }
      acceptedAnswers = [tfAnswer.value]
    } else if (type.value === 'ORDER') {
      const items = orderItems.value.filter(i => i.text.trim())
      config = { items }
      acceptedAnswers = items.map(i => i.id)
      ctx = null
    } else if (type.value === 'TRANSLATION') {
      config = { sourceLang: sourceLang.value, targetLang: targetLang.value, hint: hint.value.trim() || undefined }
      acceptedAnswers = textAnswers.value.split('\n').map(s => s.trim()).filter(Boolean)
    } else if (type.value === 'DICTATION' && dictSource.value !== 'TTS') {
      const segs = [...segments.value].sort((a, b) => a.start - b.start)
      if (dictSource.value === 'YOUTUBE' && !youtubeId(youtubeUrl.value)) throw new Error(t('qe.needYoutube'))
      if (dictSource.value === 'FILE' && !audioRef.value) throw new Error(t('qe.needRecording'))
      if (!segs.length) throw new Error(t('qe.needSegments'))
      const bad = segs.findIndex(sg => !(sg.end > sg.start) || !sg.text.trim())
      if (bad >= 0) throw new Error(t('qe.badSegment', { n: bad + 1 }))
      config = { youtubeUrl: dictSource.value === 'YOUTUBE' ? youtubeUrl.value.trim() : null, segments: segs.map(({ id, start, end }) => ({ id, start, end })), maxPlays: maxPlays.value || null, audioOnly: audioOnly.value }
      acceptedAnswers = Object.fromEntries(segs.map(sg => [sg.id, [sg.text.trim()]]))
      ctx = null
    } else if (type.value === 'WRITTEN_RESPONSE') {
      if (wrMode.value === 'SUMMARY' && !context.value.trim()) throw new Error(t('qe.needArticle'))
      if (wrMode.value === 'DESCRIBE_IMAGE' && !imageRef.value) throw new Error(t('qe.needPicture'))
      config = { mode: wrMode.value, minWords: wrMin.value || null, maxWords: wrMax.value || null, keyPoints: wrKeyPoints.value.split('\n').map(x => x.trim()).filter(Boolean), modelAnswer: wrModel.value.trim() || undefined }
      acceptedAnswers = []
    } else if (type.value === 'DICTATION') {
      const alts = textAnswers.value.split('\n').map(s => s.trim()).filter(Boolean)
      config = { ttsText: ttsText.value.trim() || alts[0] || '', ttsLang: ttsLang.value, maxPlays: maxPlays.value || null }
      acceptedAnswers = alts.length ? alts : (ttsText.value.trim() ? [ttsText.value.trim()] : [])
      ctx = null
    }

    const payload = {
      type: type.value,
      prompt: prompt.value.trim(),
      context: ctx,
      audioRef: type.value === 'DICTATION' && dictSource.value === 'YOUTUBE' ? null : (audioRef.value.trim() || null),
      imageRef: imageRef.value.trim() || null,
      config,
      acceptedAnswers,
      explanation: explanation.value.trim() || null,
      points: points.value
    }

    if (props.question) {
      await $fetch(`/api/course-questions/${props.question.id}`, { method: 'PATCH', body: payload })
    } else {
      await $fetch(`/api/course-exercises/${props.exerciseId}/questions`, { method: 'POST', body: payload })
    }
    toast.add({ title: props.question ? t('qe.updated') : t('qe.added'), color: 'success' })
    emit('saved')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form
    class="grid gap-4"
    @submit.prevent="save"
  >
    <!-- Question Type Selector + Points -->
    <div class="grid sm:grid-cols-4 gap-3">
      <UFormField
        :label="t('qe.type')"
        class="sm:col-span-3"
      >
        <USelect
          :model-value="type"
          :items="LMS_QUESTION_OPTIONS.map(o => ({ label: t(`lmsq.${o.type}.label`), value: o.type }))"
          class="w-full"
          @update:model-value="switchType($event as LmsQuestionType)"
        />
      </UFormField>
      <UFormField :label="t('qe.points')">
        <UInputNumber
          v-model="points"
          :min="1"
          :max="100"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField :label="t('qe.prompt')">
      <UTextarea
        v-model="prompt"
        :rows="2"
        class="w-full"
      />
    </UFormField>

    <!-- TYPE 1: SENTENCE_BUILD -->
    <template v-if="type === 'SENTENCE_BUILD'">
      <UFormField
        :label="t('qe.target')"
        :help="t('qe.targetHelp')"
      >
        <UInput
          v-model="sbSentence"
          :placeholder="t('qe.targetPlaceholder')"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('qe.distractors')">
        <UInput
          v-model="sbDistractors"
          placeholder="e.g. had, was"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="t('qe.acceptedSentences')"
        :help="t('qe.acceptedSentencesHelp')"
      >
        <UTextarea
          v-model="sbAltAnswers"
          :rows="2"
          class="w-full"
        />
      </UFormField>
    </template>

    <!-- TYPE 2: ERROR_SPOT -->
    <template v-else-if="type === 'ERROR_SPOT'">
      <UFormField :label="t('qe.errorSentence')">
        <UInput
          v-model="context"
          :placeholder="t('qe.errorPlaceholder')"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('qe.markError')">
        <div class="flex flex-wrap gap-1.5 rounded-xl bg-elevated/50 ring ring-default p-3">
          <button
            v-for="(tok, ti) in esTokens"
            :key="`${ti}-${tok}`"
            type="button"
            class="px-2.5 py-1 rounded-lg text-sm font-medium cursor-pointer transition-colors"
            :class="esErrorIndex === ti ? 'bg-rose-500 text-white' : 'bg-default ring ring-default text-highlighted hover:bg-primary/10'"
            @click="esErrorIndex = ti"
          >
            {{ tok }}
          </button>
        </div>
      </UFormField>
      <USwitch
        v-model="esRequireCorrection"
        :label="t('qe.requireCorrection')"
      />
      <UFormField
        v-if="esRequireCorrection"
        :label="t('qe.corrections')"
        :help="t('qe.correctionsHelp')"
      >
        <UInput
          v-model="esCorrections"
          placeholder="goes"
          class="w-full"
        />
      </UFormField>
    </template>

    <!-- TYPE 3 & 4: MCQ & SINGLE_CHOICE -->
    <template v-else-if="type === 'MCQ' || type === 'SINGLE_CHOICE'">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-highlighted">
            {{ type === 'MCQ' ? t('qe.optionsMany') : t('qe.optionsOne') }}
          </p>
          <UButton
            :label="t('qe.addOption')"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            @click="addOption"
          />
        </div>
        <div
          v-for="(opt, idx) in options"
          :key="opt.key"
          class="flex items-center gap-2"
        >
          <button
            type="button"
            class="size-8 rounded-lg border text-xs font-bold grid place-items-center shrink-0 cursor-pointer transition-colors"
            :class="selectedCorrectKeys.includes(opt.key) ? 'bg-success text-inverted border-success' : 'border-default text-muted hover:bg-elevated'"
            :title="selectedCorrectKeys.includes(opt.key) ? t('qe.markedCorrect') : t('qe.markCorrect')"
            @click="toggleCorrectKey(opt.key)"
          >
            {{ opt.key }}
          </button>
          <UInput
            v-model="opt.text"
            :placeholder="t('qe.option', { key: opt.key })"
            class="flex-1"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="options.length <= 2"
            @click="removeOption(idx)"
          />
        </div>
      </div>
    </template>

    <!-- TYPE 5: SHORT_ANSWER -->
    <template v-else-if="type === 'SHORT_ANSWER'">
      <div class="grid sm:grid-cols-2 gap-3">
        <UFormField :label="t('qe.wordLimit')">
          <UInputNumber
            v-model="wordLimit"
            :min="1"
            :max="50"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('qe.inputPlaceholder')">
          <UInput
            v-model="placeholder"
            :placeholder="t('quiz.answerPlaceholder')"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField
        :label="t('qe.accepted')"
        :help="t('qe.acceptedHelp')"
      >
        <UTextarea
          v-model="textAnswers"
          :rows="3"
          class="w-full"
        />
      </UFormField>
    </template>

    <!-- TYPE 6 & 7: NOTE_COMPLETION & SUMMARY_COMPLETION -->
    <template v-else-if="type === 'NOTE_COMPLETION' || type === 'SUMMARY_COMPLETION'">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-highlighted">
            {{ type === 'NOTE_COMPLETION' ? t('qe.notesTemplate') : t('qe.summaryText') }} {{ t('qe.gapSyntax') }}
          </label>
          <UButton
            :label="t('qe.insertGap')"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            @click="insertNextGap"
          />
        </div>
        <UTextarea
          v-model="context"
          :rows="4"
          class="w-full font-mono text-xs"
        />
      </div>
      <UFormField :label="t('qe.gapLimit')">
        <UInputNumber
          v-model="wordLimit"
          :min="1"
          :max="10"
          class="w-40"
        />
      </UFormField>
      <div
        v-if="gapNumbers.length"
        class="grid gap-2 rounded-xl bg-elevated/40 ring ring-default p-3"
      >
        <p class="text-xs font-semibold text-muted">
          {{ t('qe.gapKeys') }}
        </p>
        <div
          v-for="n in gapNumbers"
          :key="n"
          class="flex items-center gap-2"
        >
          <UBadge
            :label="t('quiz.gap', { n })"
            color="primary"
            variant="subtle"
            size="xs"
            class="w-16 justify-center"
          />
          <UInput
            v-model="gapAnswers[n]"
            :placeholder="t('qe.gapAnswers', { n })"
            class="flex-1"
            size="sm"
          />
        </div>
      </div>
    </template>

    <!-- TYPE 8: SUMMARY_DRAG_DROP -->
    <template v-else-if="type === 'SUMMARY_DRAG_DROP'">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-highlighted">Summary Text (use &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125; for drop slots)</label>
          <UButton
            :label="t('qe.insertGap')"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            @click="insertNextGap"
          />
        </div>
        <UTextarea
          v-model="context"
          :rows="3"
          class="w-full font-mono text-xs"
        />
      </div>

      <div class="flex flex-col gap-2 rounded-xl bg-elevated/40 ring ring-default p-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-muted">
            {{ t('qe.wordBank') }}
          </p>
          <UButton
            :label="t('qe.addWord')"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            @click="addBankWord"
          />
        </div>
        <div class="grid sm:grid-cols-2 gap-2">
          <div
            v-for="(w, wi) in wordBank"
            :key="w.key"
            class="flex items-center gap-1.5"
          >
            <UBadge
              :label="w.key"
              color="primary"
              variant="subtle"
              size="xs"
            />
            <UInput
              v-model="w.text"
              size="sm"
              class="flex-1"
              :placeholder="t('qe.wordPlaceholder')"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="neutral"
              variant="ghost"
              @click="wordBank.splice(wi, 1)"
            />
          </div>
        </div>
        <USwitch
          v-model="reuseWords"
          :label="t('qe.reuse')"
          size="sm"
          class="mt-1"
        />
      </div>

      <div
        v-if="gapNumbers.length"
        class="grid gap-2"
      >
        <p class="text-xs font-semibold text-muted">
          {{ t('qe.gapWords') }}
        </p>
        <div
          v-for="n in gapNumbers"
          :key="n"
          class="flex items-center gap-2"
        >
          <UBadge
            :label="t('quiz.gap', { n })"
            color="primary"
            variant="subtle"
            size="xs"
            class="w-16 justify-center"
          />
          <USelect
            v-model="gapAnswers[n]"
            :items="wordBank.filter(w => w.text.trim()).map(w => ({ label: `${w.key} — ${w.text}`, value: w.key }))"
            :placeholder="t('qe.pickWord')"
            class="flex-1"
            size="sm"
          />
        </div>
      </div>
    </template>

    <!-- TYPE 9: TRUE_FALSE -->
    <template v-else-if="type === 'TRUE_FALSE'">
      <UFormField :label="t('qe.statement')">
        <UTextarea
          v-model="context"
          :rows="2"
          class="w-full"
        />
      </UFormField>
      <div class="flex flex-wrap items-center gap-4">
        <UFormField :label="t('qe.correctAnswer')">
          <USelect
            v-model="tfAnswer"
            :items="[{ label: 'True', value: 'TRUE' }, { label: 'False', value: 'FALSE' }, ...(allowNotGiven ? [{ label: 'Not Given', value: 'NOT_GIVEN' }] : [])]"
            class="w-40"
          />
        </UFormField>
        <USwitch
          v-model="allowNotGiven"
          :label="t('qe.includeNotGiven')"
          class="mt-5"
        />
      </div>
    </template>

    <!-- TYPE 10: ORDER -->
    <template v-else-if="type === 'ORDER'">
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-highlighted">
            {{ t('qe.orderItems') }}
          </p>
          <UButton
            :label="t('qe.addStep')"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            @click="addOrderItem"
          />
        </div>
        <div
          v-for="(item, idx) in orderItems"
          :key="item.id"
          class="flex items-center gap-2"
        >
          <span class="size-6 rounded-full bg-elevated text-xs font-bold grid place-items-center shrink-0">{{ idx + 1 }}</span>
          <UInput
            v-model="item.text"
            :placeholder="t('qe.stepPlaceholder')"
            class="flex-1"
          />
          <UButton
            icon="i-lucide-arrow-up"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="idx === 0"
            @click="moveOrder(idx, -1)"
          />
          <UButton
            icon="i-lucide-arrow-down"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="idx === orderItems.length - 1"
            @click="moveOrder(idx, 1)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="orderItems.length <= 2"
            @click="orderItems.splice(idx, 1)"
          />
        </div>
      </div>
    </template>

    <!-- TYPE 11: TRANSLATION -->
    <template v-else-if="type === 'TRANSLATION'">
      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('qe.fromLang')">
          <USelect
            v-model="sourceLang"
            :items="['UZ', 'RU', 'EN']"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('qe.toLang')">
          <USelect
            v-model="targetLang"
            :items="['EN', 'UZ', 'RU']"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField :label="t('qe.sourceSentence')">
        <UTextarea
          v-model="context"
          :rows="2"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="t('qe.acceptedTranslations')"
        :help="t('qe.acceptedTranslationsHelp')"
      >
        <UTextarea
          v-model="textAnswers"
          :rows="3"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('qe.hint')">
        <UInput
          v-model="hint"
          placeholder="e.g. Use Present Simple"
          class="w-full"
        />
      </UFormField>
    </template>

    <!-- TYPE 12: DICTATION -->
    <template v-else-if="type === 'DICTATION'">
      <UFormField :label="t('qe.dictSource')">
        <UTabs
          v-model="dictSource"
          :items="[
            { label: t('qe.srcTts'), value: 'TTS', icon: 'i-lucide-audio-lines' },
            { label: t('qe.srcFile'), value: 'FILE', icon: 'i-lucide-file-audio' },
            { label: t('qe.srcYoutube'), value: 'YOUTUBE', icon: 'i-simple-icons-youtube' }
          ]"
          :content="false"
          size="sm"
          data-testid="dict-source"
        />
      </UFormField>

      <!-- One clip, or text read aloud by the browser -->
      <template v-if="dictSource === 'TTS'">
        <div class="rounded-xl bg-elevated/40 ring ring-default p-3 flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-semibold text-highlighted">
              {{ t('qe.audioSource') }}
            </p>
            <label class="cursor-pointer">
              <UButton
                as="span"
                :label="uploadingAudio ? t('qe.uploading') : t('qe.uploadAudio')"
                icon="i-lucide-upload"
                size="xs"
                variant="outline"
                :loading="uploadingAudio"
              />
              <input
                type="file"
                accept="audio/*"
                class="hidden"
                @change="onUploadAudio"
              >
            </label>
          </div>
          <audio
            v-if="audioRef"
            :src="mediaUrl(audioRef)"
            controls
            class="w-full h-9"
          />
          <div class="grid sm:grid-cols-3 gap-2">
            <UFormField
              :label="t('qe.tts')"
              class="sm:col-span-2"
            >
              <UInput
                v-model="ttsText"
                :placeholder="t('qe.ttsPlaceholder')"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('qe.replays')">
              <UInputNumber
                v-model="maxPlays"
                :min="1"
                :max="20"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
        <UFormField
          :label="t('qe.transcripts')"
          :help="t('qe.transcriptsHelp')"
        >
          <UTextarea
            v-model="textAnswers"
            :rows="2"
            class="w-full"
          />
        </UFormField>
      </template>

      <!-- A recording or a YouTube video, in timed segments -->
      <template v-else>
        <div class="rounded-xl bg-elevated/40 ring ring-default p-3 flex flex-col gap-3">
          <div
            v-if="dictSource === 'FILE'"
            class="flex flex-wrap items-center gap-2"
          >
            <label class="cursor-pointer">
              <UButton
                as="span"
                :label="uploadingMedia ? t('qe.uploading') : (audioRef ? t('qe.replaceRecording') : t('qe.uploadRecording'))"
                icon="i-lucide-upload"
                size="sm"
                variant="outline"
                :loading="uploadingMedia"
              />
              <input
                type="file"
                accept="audio/*,video/mp4,video/webm,video/quicktime"
                class="hidden"
                data-testid="dict-upload"
                @change="onUploadMedia"
              >
            </label>
            <span class="text-xs text-muted">{{ t('qe.recordingHelp') }}</span>
          </div>
          <UFormField
            v-else
            :label="t('qe.youtubeLink')"
          >
            <UInput
              v-model="youtubeUrl"
              placeholder="https://www.youtube.com/watch?v=…"
              icon="i-simple-icons-youtube"
              class="w-full"
              data-testid="dict-youtube"
            />
          </UFormField>
          <LmsSegmentMedia
            v-if="(dictSource === 'FILE' && audioRef) || (dictSource === 'YOUTUBE' && youtubeId(youtubeUrl))"
            ref="media"
            :src="dictSource === 'FILE' ? audioRef : null"
            :youtube-url="dictSource === 'YOUTUBE' ? youtubeUrl : null"
            controls
            @ended="previewing = null"
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-bold text-highlighted me-auto">
              {{ t('qe.segments', { n: segments.length }) }}
            </p>
            <UButton
              v-if="dictSource === 'FILE'"
              :label="t('qe.autoSplit')"
              icon="i-lucide-sparkles"
              size="xs"
              :loading="splitting"
              :disabled="!audioRef"
              data-testid="dict-autosplit"
              @click="autoSplit"
            />
            <UButton
              :label="t('qe.pasteTimes')"
              icon="i-lucide-clipboard-paste"
              size="xs"
              color="neutral"
              variant="outline"
              data-testid="dict-paste"
              @click="pasteOpen = true"
            />
            <UButton
              :label="t('qe.addSegment')"
              icon="i-lucide-plus"
              size="xs"
              color="neutral"
              variant="outline"
              data-testid="dict-add"
              @click="addSegment"
            />
          </div>
          <p
            v-if="!segments.length"
            class="text-xs text-muted"
          >
            {{ t('qe.segmentsHelp') }}
          </p>
          <div
            v-for="(seg, i) in segments"
            :key="seg.id"
            class="rounded-lg ring ring-default p-2.5 flex flex-col gap-2"
            data-testid="dict-segment"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs font-extrabold text-dimmed w-5 tabular-nums">{{ i + 1 }}</span>
              <UInput
                :model-value="fmtTime(seg.start)"
                size="xs"
                class="w-20 font-mono"
                :aria-label="t('qe.start')"
                @change="(e: Event) => setTime(seg, 'start', (e.target as HTMLInputElement).value)"
              />
              <UTooltip :text="t('qe.setFromPlayer')">
                <UButton
                  icon="i-lucide-map-pin"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :aria-label="t('qe.setFromPlayer')"
                  @click="markNow(seg, 'start')"
                />
              </UTooltip>
              <span class="text-dimmed">–</span>
              <UInput
                :model-value="fmtTime(seg.end)"
                size="xs"
                class="w-20 font-mono"
                :aria-label="t('qe.end')"
                @change="(e: Event) => setTime(seg, 'end', (e.target as HTMLInputElement).value)"
              />
              <UTooltip :text="t('qe.setFromPlayer')">
                <UButton
                  icon="i-lucide-map-pin"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :aria-label="t('qe.setFromPlayer')"
                  @click="markNow(seg, 'end')"
                />
              </UTooltip>
              <UButton
                :icon="previewing === seg.id ? 'i-lucide-volume-2' : 'i-lucide-play'"
                size="xs"
                color="neutral"
                variant="outline"
                class="ms-auto"
                :aria-label="t('quiz.play')"
                @click="preview(seg)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                :aria-label="t('common.delete')"
                @click="segments.splice(i, 1)"
              />
            </div>
            <UTextarea
              v-model="seg.text"
              :rows="1"
              autoresize
              :placeholder="t('qe.segmentText')"
              class="w-full"
            />
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-3">
          <UFormField
            :label="t('qe.playsPerSegment')"
            :help="t('qe.unlimitedHelp')"
          >
            <UInputNumber
              v-model="maxPlays"
              :min="1"
              :max="20"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="dictSource === 'FILE' && isVideoFile(audioRef)"
            :label="t('qe.audioOnly')"
          >
            <USwitch
              v-model="audioOnly"
              :label="t('qe.audioOnlyHelp')"
            />
          </UFormField>
        </div>

        <UModal
          v-model:open="pasteOpen"
          :title="t('qe.pasteTimes')"
          :description="t('qe.pasteHelp')"
        >
          <template #body>
            <UTextarea
              v-model="pasteText"
              :rows="8"
              autofocus
              placeholder="00:01-00:09 The museum opens at nine.&#10;00:09-00:15 Tickets cost five pounds."
              class="w-full font-mono"
              data-testid="dict-paste-text"
            />
            <p class="text-xs text-muted mt-2">
              {{ t('qe.pasteFound', { n: pasted.length }) }}
            </p>
          </template>
          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton
                :label="t('common.cancel')"
                color="neutral"
                variant="ghost"
                @click="pasteOpen = false"
              />
              <UButton
                :label="t('qe.useSegments', { n: pasted.length })"
                :disabled="!pasted.length"
                data-testid="dict-paste-apply"
                @click="applyPaste"
              />
            </div>
          </template>
        </UModal>
      </template>
    </template>

    <!-- TYPE 13: WRITTEN_RESPONSE -->
    <template v-else-if="type === 'WRITTEN_RESPONSE'">
      <UFormField :label="t('qe.wrMode')">
        <UTabs
          v-model="wrMode"
          :items="[
            { label: t('qe.wrSummary'), value: 'SUMMARY', icon: 'i-lucide-newspaper' },
            { label: t('qe.wrImage'), value: 'DESCRIBE_IMAGE', icon: 'i-lucide-image' },
            { label: t('qe.wrResponse'), value: 'RESPONSE', icon: 'i-lucide-message-square-text' }
          ]"
          :content="false"
          size="sm"
          data-testid="wr-mode"
        />
      </UFormField>
      <UFormField
        v-if="wrMode !== 'DESCRIBE_IMAGE'"
        :label="wrMode === 'SUMMARY' ? t('qe.article') : t('qe.material')"
        :help="wrMode === 'SUMMARY' ? t('qe.articleHelp') : t('qe.materialHelp')"
        :required="wrMode === 'SUMMARY'"
      >
        <UTextarea
          v-model="context"
          :rows="8"
          autoresize
          :maxrows="18"
          class="w-full"
          data-testid="wr-article"
        />
      </UFormField>
      <p
        v-else
        class="text-sm text-muted flex items-center gap-1.5"
      >
        <UIcon
          name="i-lucide-image"
          class="size-4"
        />{{ imageRef ? t('qe.pictureSet') : t('qe.pictureBelow') }}
      </p>
      <div class="grid grid-cols-2 gap-3">
        <UFormField :label="t('qe.minWords')">
          <UInputNumber
            v-model="wrMin"
            :min="0"
            :max="2000"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('qe.maxWords')">
          <UInputNumber
            v-model="wrMax"
            :min="0"
            :max="3000"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="rounded-xl bg-elevated/40 ring ring-default p-3 flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-sm font-bold text-highlighted me-auto">
            {{ t('qe.forMarking') }}
          </p>
          <UButton
            :label="t('qe.draftWithAi')"
            icon="i-lucide-sparkles"
            size="xs"
            :loading="drafting"
            data-testid="wr-draft"
            @click="draftKeys"
          />
        </div>
        <UFormField
          :label="t('qe.keyPoints')"
          :help="t('qe.keyPointsHelp')"
        >
          <UTextarea
            v-model="wrKeyPoints"
            :rows="4"
            autoresize
            class="w-full"
            data-testid="wr-keypoints"
          />
        </UFormField>
        <UFormField
          :label="t('qe.modelAnswer')"
          :help="t('qe.modelAnswerHelp')"
        >
          <UTextarea
            v-model="wrModel"
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <!-- Optional Illustration & Explanation -->
    <div class="grid sm:grid-cols-2 gap-3 pt-2 border-t border-default">
      <UFormField :label="t('qe.explanation')">
        <UTextarea
          v-model="explanation"
          :rows="2"
          :placeholder="t('qe.explanationPlaceholder')"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('qe.image')">
        <div class="flex items-center gap-2">
          <label class="cursor-pointer">
            <UButton
              as="span"
              :label="uploadingImage ? t('qe.uploading') : (imageRef ? t('builder.coverChange') : t('qe.uploadImage'))"
              icon="i-lucide-image"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="uploadingImage"
            />
            <input
              type="file"
              accept="image/*"
              class="hidden"
              @change="onUploadImage"
            >
          </label>
          <UButton
            v-if="imageRef"
            icon="i-lucide-x"
            size="xs"
            color="error"
            variant="ghost"
            @click="imageRef = ''"
          />
        </div>
        <img
          v-if="imageRef"
          :src="mediaUrl(imageRef)"
          alt="Preview"
          class="mt-2 h-16 rounded-lg object-cover border border-default"
        >
      </UFormField>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <UButton
        :label="t('common.cancel')"
        color="neutral"
        variant="ghost"
        @click="emit('close')"
      />
      <UButton
        type="submit"
        :label="question ? t('common.save') : t('xe.addQuestion')"
        :loading="saving"
      />
    </div>
  </form>
</template>
