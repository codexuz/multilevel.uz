<script setup lang="ts">
import type { SpeakingAssessmentSummary, SpeakingAssessmentValues } from './AssessModal.vue'

export interface SpeakingAiReviewDto {
  overall: number
  fluency: number
  vocabulary: number
  grammar: number
  pronunciation: number
  transcript: string
  summary: string
  strengths: string[]
  improvements: string[]
  assessedAt: string
}

export interface SpeakingPostDto {
  id: string
  questionId: string
  lessonId?: string | null
  exerciseId?: string | null
  questionTitle: string
  questionPrompt: string
  questionPartLabel: string | null
  audioUrl: string
  durationSeconds: number | null
  note: string | null
  aiReview?: SpeakingAiReviewDto | null
  createdAt: string
  author: { id: string, name: string, avatarUrl: string | null, isTeacher: boolean }
  isMine: boolean
  teaches?: boolean
  canAssess: boolean
  canAiAssess?: boolean
  canDelete: boolean
  likesCount: number
  likedByMe: boolean
  assessmentSummary: SpeakingAssessmentSummary
  myAssessment: SpeakingAssessmentValues | null
  commentsCount: number
}

const props = defineProps<{
  rec: SpeakingPostDto
  courseSlug: string
  backTo?: string
  showQuestionTitle?: boolean
}>()

const emit = defineEmits<{
  assess: [rec: SpeakingPostDto]
  deleted: [id: string]
  updated: [patch: Partial<SpeakingPostDto> & { id: string }]
}>()

const { t } = useI18n()
const toast = useToast()
const { confirm } = useDialogs()

const detailBase = computed(() => `/courses/${props.courseSlug}/speaking/${props.rec.id}`)
const detailUrl = (tab: 'comments' | 'reactions') => ({
  path: detailBase.value,
  query: {
    tab,
    ...(props.backTo ? { back: props.backTo } : {})
  }
})

const fmtTime = (sec: number | null | undefined) => {
  if (!sec || !Number.isFinite(sec)) return null
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const likeBusy = ref(false)
async function toggleLike() {
  if (likeBusy.value) return
  likeBusy.value = true
  try {
    const res = await $fetch<{ liked: boolean, likesCount: number }>(`/api/speaking-recordings/${props.rec.id}/like`, { method: 'POST' })
    emit('updated', { id: props.rec.id, likedByMe: res.liked, likesCount: res.likesCount })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    likeBusy.value = false
  }
}

const aiBusy = ref(false)
async function runAiAssess() {
  if (aiBusy.value) return
  aiBusy.value = true
  try {
    const res = await $fetch<{ aiReview: SpeakingAiReviewDto }>(`/api/speaking-recordings/${props.rec.id}/ai-assess`, { method: 'POST' })
    emit('updated', { id: props.rec.id, aiReview: res.aiReview })
    toast.add({ title: t('speakingStudio.aiAssessed'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    aiBusy.value = false
  }
}

async function remove() {
  const ok = await confirm({
    title: t('common.delete'),
    description: t('speakingStudio.deleteRecordingConfirm'),
    confirmLabel: t('common.delete'),
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/speaking-recordings/${props.rec.id}`, { method: 'DELETE' })
    toast.add({ title: t('speakingStudio.recordingDeleted'), color: 'success' })
    emit('deleted', props.rec.id)
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <UCard
    variant="outline"
    :ui="{
      header: 'flex flex-wrap items-start justify-between gap-2 pb-3',
      body: 'flex flex-col gap-3 py-3',
      footer: 'p-1.5 sm:px-2'
    }"
    data-testid="speaking-post-card"
  >
    <template #header>
      <div class="flex items-center gap-2 min-w-0">
        <UUser
          :name="rec.author.name"
          :description="localeDate(rec.createdAt, intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })"
          :avatar="{ src: rec.author.avatarUrl || undefined, alt: rec.author.name }"
          size="sm"
        />
        <UBadge
          v-if="rec.author.isTeacher"
          :label="t('speakingStudio.teacherBadge')"
          color="primary"
          variant="subtle"
          size="xs"
        />
      </div>

      <div class="flex items-center gap-1.5">
        <UBadge
          v-if="showQuestionTitle && rec.questionTitle"
          icon="i-lucide-mic"
          :label="rec.questionTitle"
          color="neutral"
          variant="soft"
          size="sm"
          class="max-w-48 truncate"
        />
        <UBadge
          v-if="fmtTime(rec.durationSeconds)"
          icon="i-lucide-clock"
          :label="fmtTime(rec.durationSeconds)!"
          color="neutral"
          variant="subtle"
          size="xs"
        />
        <UButton
          v-if="rec.canDelete"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          square
          :aria-label="t('common.delete')"
          @click="remove"
        />
      </div>
    </template>

    <!-- Audio Player -->
    <MediaWaveAudio
      :src="rec.audioUrl"
      :title="rec.questionTitle"
    />

    <!-- Optional Speaker Note -->
    <p
      v-if="rec.note"
      class="text-sm text-toned whitespace-pre-line"
    >
      {{ rec.note }}
    </p>

    <!-- AI & Teacher / Peer Band Assessment Badges (0-9) -->
    <div
      v-if="rec.aiReview || rec.assessmentSummary.count"
      class="flex flex-wrap items-center gap-1.5"
    >
      <UBadge
        v-if="rec.aiReview"
        icon="i-lucide-sparkles"
        :label="t('speakingStudio.aiBandBadge', { score: rec.aiReview.overall })"
        color="primary"
        variant="soft"
        size="sm"
      />
      <UBadge
        v-if="rec.assessmentSummary.teacherAvgOverall != null"
        icon="i-lucide-award"
        :label="t('speakingStudio.teacherBandBadge', { score: rec.assessmentSummary.teacherAvgOverall })"
        color="success"
        variant="soft"
        size="sm"
      />
      <UBadge
        v-if="rec.assessmentSummary.peerAvgOverall != null"
        icon="i-lucide-star"
        :label="t('speakingStudio.peerBandBadge', { score: rec.assessmentSummary.peerAvgOverall, n: rec.assessmentSummary.peerCount ?? 0 })"
        color="warning"
        variant="soft"
        size="sm"
      />
    </div>

    <!-- AI Summary Preview (1-2 lines, full details on post page) -->
    <UAlert
      v-if="rec.aiReview?.summary"
      icon="i-lucide-sparkles"
      color="primary"
      variant="subtle"
      :description="rec.aiReview.summary"
      :ui="{ description: 'text-xs line-clamp-2' }"
    />

    <!-- Facebook / Instagram Engagement Stats Row (clicks open dedicated Comments & Reactions page) -->
    <div class="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted">
      <div class="flex items-center gap-3">
        <NuxtLink
          :to="detailUrl('reactions')"
          class="inline-flex items-center gap-1 hover:text-highlighted hover:underline"
          data-testid="post-likes-link"
        >
          <UIcon
            name="i-lucide-heart"
            class="size-3.5"
            :class="rec.likesCount ? 'text-error' : ''"
          />
          <span>{{ t('speakingStudio.likesCount', { n: rec.likesCount }, rec.likesCount) }}</span>
        </NuxtLink>
        <NuxtLink
          v-if="rec.assessmentSummary.count"
          :to="detailUrl('reactions')"
          class="inline-flex items-center gap-1 hover:text-highlighted hover:underline"
          data-testid="post-ratings-link"
        >
          <UIcon
            name="i-lucide-star"
            class="size-3.5 text-warning"
          />
          <span>{{ rec.assessmentSummary.avgOverall }}/9 · {{ t('speakingStudio.ratingsCount', { n: rec.assessmentSummary.count }, rec.assessmentSummary.count) }}</span>
        </NuxtLink>
      </div>
      <NuxtLink
        :to="detailUrl('comments')"
        class="hover:text-highlighted hover:underline"
        data-testid="post-comments-link"
      >
        {{ t('speakingStudio.commentsCount', { n: rec.commentsCount }, rec.commentsCount) }}
      </NuxtLink>
    </div>

    <!-- Facebook / Instagram Bottom Action Bar -->
    <template #footer>
      <div class="grid grid-flow-col auto-cols-fr gap-1">
        <UButton
          :icon="rec.likedByMe ? 'i-lucide-heart' : 'i-lucide-heart'"
          :label="rec.likedByMe ? t('speakingStudio.liked') : t('speakingStudio.like')"
          :color="rec.likedByMe ? 'error' : 'neutral'"
          :variant="rec.likedByMe ? 'soft' : 'ghost'"
          size="sm"
          class="justify-center"
          :loading="likeBusy"
          data-testid="post-like-btn"
          @click="toggleLike"
        />
        <UButton
          v-if="rec.canAssess"
          icon="i-lucide-star"
          :label="rec.myAssessment ? t('speakingStudio.ratedBadge', { score: rec.myAssessment.overall }) : (rec.teaches ? t('speakingStudio.assessBtn') : t('speakingStudio.rateBtn'))"
          :color="rec.myAssessment ? 'warning' : 'neutral'"
          :variant="rec.myAssessment ? 'soft' : 'ghost'"
          size="sm"
          class="justify-center"
          data-testid="post-rate-btn"
          @click="emit('assess', rec)"
        />
        <UButton
          v-if="rec.canAiAssess"
          icon="i-lucide-sparkles"
          :label="rec.aiReview ? t('speakingStudio.reAiAssess') : t('speakingStudio.aiAssessBtn')"
          color="primary"
          variant="ghost"
          size="sm"
          class="justify-center"
          :loading="aiBusy"
          data-testid="post-ai-btn"
          @click="runAiAssess"
        />
        <UButton
          :to="detailUrl('comments')"
          icon="i-lucide-message-circle"
          :label="t('speakingStudio.commentsBtn')"
          color="neutral"
          variant="ghost"
          size="sm"
          class="justify-center"
          data-testid="post-comment-btn"
        />
      </div>
    </template>
  </UCard>
</template>
