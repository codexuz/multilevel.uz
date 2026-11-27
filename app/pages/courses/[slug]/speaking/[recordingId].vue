<script setup lang="ts">
import type { SpeakingAssessmentSummary, SpeakingAssessmentValues } from '~/components/course/speaking/AssessModal.vue'
import type { SpeakingAiReviewDto, SpeakingPostDto } from '~/components/course/speaking/PostCard.vue'

interface AuthorDto {
  id: string
  name: string
  avatarUrl: string | null
  isTeacher: boolean
}

interface CommentDto {
  id: string
  body: string
  createdAt: string
  author: AuthorDto
  canDelete: boolean
}

interface AssessmentRowDto {
  id: string
  overall: number
  fluency: number | null
  vocabulary: number | null
  grammar: number | null
  pronunciation: number | null
  createdAt: string
  updatedAt: string
  author: AuthorDto
}

interface LikeRowDto extends AuthorDto {
  createdAt: string
}

interface RecordingDetailResponse {
  course: { id: string, slug: string, title: string }
  teaches: boolean
  recording: SpeakingPostDto & { questionTips?: string | null }
  likes: LikeRowDto[]
  assessments: AssessmentRowDto[]
  comments: CommentDto[]
}

definePageMeta({ layout: 'course' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { confirm } = useDialogs()

const slug = computed(() => String(route.params.slug))
const recordingId = computed(() => String(route.params.recordingId))

const { data, error, refresh } = await useFetch<RecordingDetailResponse>(
  () => `/api/speaking-recordings/${recordingId.value}`
)

if (error.value?.statusCode === 403) {
  await navigateTo(`/courses/${slug.value}`)
} else if (error.value || !data.value) {
  throw createError({ statusCode: 404, statusMessage: t('courses.notFound'), fatal: true })
}

const backPath = computed(() => {
  const q = typeof route.query.back === 'string' ? route.query.back : ''
  if (q && q.startsWith('/courses/') && !q.startsWith('//')) return q
  if (data.value?.recording.lessonId) return `/courses/${slug.value}/${data.value.recording.lessonId}`
  return `/courses/${slug.value}/speaking`
})

useSeoMeta({
  title: () => (data.value ? `${data.value.recording.author.name} · ${data.value.recording.questionTitle}` : t('speakingStudio.title')),
  robots: 'noindex'
})

// FB/IG Tabs: Comments vs Likes & Ratings
const tab = ref<'comments' | 'reactions'>(route.query.tab === 'reactions' ? 'reactions' : 'comments')
watch(tab, (v) => {
  router.replace({ query: { ...route.query, tab: v } })
})
const tabItems = computed(() => [
  {
    label: t('speakingStudio.commentsTab', { n: data.value?.comments.length ?? 0 }),
    value: 'comments',
    icon: 'i-lucide-message-circle'
  },
  {
    label: t('speakingStudio.reactionsTab', { n: (data.value?.likes.length ?? 0) + (data.value?.assessments.length ?? 0) }),
    value: 'reactions',
    icon: 'i-lucide-heart'
  }
])

const teacherAssessments = computed(() => (data.value?.assessments ?? []).filter(a => a.author.isTeacher))
const peerAssessments = computed(() => (data.value?.assessments ?? []).filter(a => !a.author.isTeacher))

const fmtTime = (sec: number | null | undefined) => {
  if (!sec || !Number.isFinite(sec)) return null
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

// ---- Actions: Like, Rate/Assess (0-9), AI Assess, Delete ----
const likeBusy = ref(false)
async function toggleLike() {
  if (!data.value || likeBusy.value) return
  likeBusy.value = true
  try {
    await $fetch(`/api/speaking-recordings/${recordingId.value}/like`, { method: 'POST' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    likeBusy.value = false
  }
}

const assessOpen = ref(false)
async function onAssessmentSaved(_payload: { recordingId: string, assessmentSummary: SpeakingAssessmentSummary, myAssessment: SpeakingAssessmentValues }) {
  await refresh()
}

const aiBusy = ref(false)
async function runAiAssess() {
  if (aiBusy.value) return
  aiBusy.value = true
  try {
    const res = await $fetch<{ aiReview: SpeakingAiReviewDto }>(`/api/speaking-recordings/${recordingId.value}/ai-assess`, { method: 'POST' })
    if (data.value) data.value.recording.aiReview = res.aiReview
    toast.add({ title: t('speakingStudio.aiAssessed'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    aiBusy.value = false
  }
}

async function deleteRecording() {
  const ok = await confirm({
    title: t('common.delete'),
    description: t('speakingStudio.deleteRecordingConfirm'),
    confirmLabel: t('common.delete'),
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/speaking-recordings/${recordingId.value}`, { method: 'DELETE' })
    toast.add({ title: t('speakingStudio.recordingDeleted'), color: 'success' })
    await navigateTo(backPath.value)
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}

// ---- Comments ----
const commentDraft = ref('')
const commentBusy = ref(false)
async function postComment() {
  const body = commentDraft.value.trim()
  if (!body || commentBusy.value || !data.value) return
  commentBusy.value = true
  try {
    const created = await $fetch<CommentDto>(`/api/speaking-recordings/${recordingId.value}/comments`, {
      method: 'POST',
      body: { body }
    })
    data.value.comments.push(created)
    data.value.recording.commentsCount = data.value.comments.length
    commentDraft.value = ''
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    commentBusy.value = false
  }
}

async function removeComment(c: CommentDto) {
  const ok = await confirm({
    title: t('common.delete'),
    description: t('speakingStudio.deleteCommentConfirm'),
    confirmLabel: t('common.delete'),
    color: 'error'
  })
  if (!ok) return
  try {
    await $fetch(`/api/speaking-comments/${c.id}`, { method: 'DELETE' })
    if (data.value) {
      data.value.comments = data.value.comments.filter(x => x.id !== c.id)
      data.value.recording.commentsCount = data.value.comments.length
    }
    toast.add({ title: t('speakingStudio.commentDeleted'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    v-if="data"
    :title="data.recording.questionTitle || t('speakingStudio.title')"
    :back="backPath"
    icon="i-lucide-mic"
  >
    <UContainer class="max-w-3xl px-0 flex flex-col gap-5">
      <!-- Main Post Card -->
      <UCard
        variant="outline"
        :ui="{
          header: 'flex flex-wrap items-start justify-between gap-2',
          body: 'flex flex-col gap-4',
          footer: 'p-1.5 sm:px-2'
        }"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <UUser
              :name="data.recording.author.name"
              :description="localeDate(data.recording.createdAt, intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })"
              :avatar="{ src: data.recording.author.avatarUrl || undefined, alt: data.recording.author.name }"
              size="md"
            />
            <UBadge
              v-if="data.recording.author.isTeacher"
              :label="t('speakingStudio.teacherBadge')"
              color="primary"
              variant="subtle"
              size="xs"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <UBadge
              v-if="fmtTime(data.recording.durationSeconds)"
              icon="i-lucide-clock"
              :label="fmtTime(data.recording.durationSeconds)!"
              color="neutral"
              variant="subtle"
              size="sm"
            />
            <UButton
              v-if="data.recording.canDelete"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('common.delete')"
              @click="deleteRecording"
            />
          </div>
        </template>

        <!-- Prompt Context -->
        <UAlert
          v-if="data.recording.questionPrompt"
          icon="i-lucide-message-square-quote"
          color="neutral"
          variant="soft"
          :title="data.recording.questionTitle"
          :description="data.recording.questionPrompt"
        />

        <!-- Audio Player -->
        <MediaWaveAudio
          :src="data.recording.audioUrl"
          :title="data.recording.questionTitle"
        />

        <p
          v-if="data.recording.note"
          class="text-sm text-toned whitespace-pre-line"
        >
          {{ data.recording.note }}
        </p>

        <!-- Score Summary Pills -->
        <div
          v-if="data.recording.aiReview || data.recording.assessmentSummary.count"
          class="flex flex-wrap items-center gap-2"
        >
          <UBadge
            v-if="data.recording.aiReview"
            icon="i-lucide-sparkles"
            :label="t('speakingStudio.aiBandBadge', { score: data.recording.aiReview.overall })"
            color="primary"
            variant="soft"
            size="md"
          />
          <UBadge
            v-if="data.recording.assessmentSummary.teacherAvgOverall != null"
            icon="i-lucide-award"
            :label="t('speakingStudio.teacherBandBadge', { score: data.recording.assessmentSummary.teacherAvgOverall })"
            color="success"
            variant="soft"
            size="md"
          />
          <UBadge
            v-if="data.recording.assessmentSummary.peerAvgOverall != null"
            icon="i-lucide-star"
            :label="t('speakingStudio.peerBandBadge', { score: data.recording.assessmentSummary.peerAvgOverall, n: data.recording.assessmentSummary.peerCount ?? 0 })"
            color="warning"
            variant="soft"
            size="md"
          />
        </div>

        <template #footer>
          <div class="grid grid-flow-col auto-cols-fr gap-1">
            <UButton
              icon="i-lucide-heart"
              :label="`${data.recording.likedByMe ? t('speakingStudio.liked') : t('speakingStudio.like')} (${data.recording.likesCount})`"
              :color="data.recording.likedByMe ? 'error' : 'neutral'"
              :variant="data.recording.likedByMe ? 'soft' : 'ghost'"
              size="sm"
              class="justify-center"
              :loading="likeBusy"
              @click="toggleLike"
            />
            <UButton
              v-if="data.recording.canAssess"
              icon="i-lucide-star"
              :label="data.recording.myAssessment ? t('speakingStudio.ratedBadge', { score: data.recording.myAssessment.overall }) : (data.teaches ? t('speakingStudio.assessBtn') : t('speakingStudio.rateBtn'))"
              :color="data.recording.myAssessment ? 'warning' : 'neutral'"
              :variant="data.recording.myAssessment ? 'soft' : 'ghost'"
              size="sm"
              class="justify-center"
              @click="assessOpen = true"
            />
            <UButton
              v-if="data.recording.canAiAssess"
              icon="i-lucide-sparkles"
              :label="data.recording.aiReview ? t('speakingStudio.reAiAssess') : t('speakingStudio.aiAssessBtn')"
              color="primary"
              variant="ghost"
              size="sm"
              class="justify-center"
              :loading="aiBusy"
              @click="runAiAssess"
            />
          </div>
        </template>
      </UCard>

      <!-- Full AI Speaking Assessment Panel (0-9 band scale) -->
      <UCard
        v-if="data.recording.aiReview"
        variant="subtle"
        :ui="{ header: 'flex flex-wrap items-center justify-between gap-2', body: 'flex flex-col gap-3' }"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon
              name="i-lucide-sparkles"
              class="size-4 text-primary"
            />
            <p class="font-semibold text-highlighted">
              {{ t('speakingStudio.aiAssessmentTitle') }}
            </p>
          </div>
          <UBadge
            :label="`${data.recording.aiReview.overall} / 9`"
            color="primary"
            variant="solid"
            size="md"
          />
        </template>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <UCard :ui="{ body: 'p-2.5 text-center' }">
            <p class="text-[11px] text-muted">
              {{ t('speakingStudio.critFluency') }}
            </p>
            <p class="text-base font-bold text-highlighted tabular-nums">
              {{ data.recording.aiReview.fluency }}/9
            </p>
          </UCard>
          <UCard :ui="{ body: 'p-2.5 text-center' }">
            <p class="text-[11px] text-muted">
              {{ t('speakingStudio.critVocabulary') }}
            </p>
            <p class="text-base font-bold text-highlighted tabular-nums">
              {{ data.recording.aiReview.vocabulary }}/9
            </p>
          </UCard>
          <UCard :ui="{ body: 'p-2.5 text-center' }">
            <p class="text-[11px] text-muted">
              {{ t('speakingStudio.critGrammar') }}
            </p>
            <p class="text-base font-bold text-highlighted tabular-nums">
              {{ data.recording.aiReview.grammar }}/9
            </p>
          </UCard>
          <UCard :ui="{ body: 'p-2.5 text-center' }">
            <p class="text-[11px] text-muted">
              {{ t('speakingStudio.critPronunciation') }}
            </p>
            <p class="text-base font-bold text-highlighted tabular-nums">
              {{ data.recording.aiReview.pronunciation }}/9
            </p>
          </UCard>
        </div>

        <p class="text-sm text-toned">
          {{ data.recording.aiReview.summary }}
        </p>

        <div class="grid sm:grid-cols-2 gap-3">
          <div v-if="data.recording.aiReview.strengths?.length">
            <p class="text-xs font-semibold text-success mb-1">
              {{ t('speakingStudio.aiStrengths') }}
            </p>
            <ul class="list-disc list-inside text-xs text-toned space-y-1">
              <li
                v-for="(s, i) in data.recording.aiReview.strengths"
                :key="i"
              >
                {{ s }}
              </li>
            </ul>
          </div>
          <div v-if="data.recording.aiReview.improvements?.length">
            <p class="text-xs font-semibold text-warning mb-1">
              {{ t('speakingStudio.aiImprovements') }}
            </p>
            <ul class="list-disc list-inside text-xs text-toned space-y-1">
              <li
                v-for="(s, i) in data.recording.aiReview.improvements"
                :key="i"
              >
                {{ s }}
              </li>
            </ul>
          </div>
        </div>

        <div
          v-if="data.recording.aiReview.transcript"
          class="pt-1 border-t border-default"
        >
          <p class="text-xs font-semibold text-muted mb-1">
            {{ t('speakingStudio.aiTranscript') }}
          </p>
          <p class="text-xs text-muted whitespace-pre-line">
            {{ data.recording.aiReview.transcript }}
          </p>
        </div>
      </UCard>

      <!-- FB / IG Tabs: Comments vs Likes & 0-9 Ratings -->
      <UTabs
        v-model="tab"
        :items="tabItems"
        :content="false"
        variant="link"
      />

      <!-- Comments Tab -->
      <UCard
        v-if="tab === 'comments'"
        variant="outline"
        :ui="{ body: 'flex flex-col gap-4' }"
        data-testid="speaking-comments-panel"
      >
        <div
          v-if="data.comments.length"
          class="flex flex-col divide-y divide-default"
        >
          <div
            v-for="c in data.comments"
            :key="c.id"
            class="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
          >
            <div class="flex flex-col gap-1 min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <UUser
                  :name="c.author.name"
                  :description="localeDate(c.createdAt, intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })"
                  :avatar="{ src: c.author.avatarUrl || undefined, alt: c.author.name }"
                  size="xs"
                />
                <UBadge
                  v-if="c.author.isTeacher"
                  :label="t('speakingStudio.teacherBadge')"
                  color="primary"
                  variant="subtle"
                  size="xs"
                />
              </div>
              <p class="text-sm text-toned whitespace-pre-line ps-8">
                {{ c.body }}
              </p>
            </div>
            <UButton
              v-if="c.canDelete"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('common.delete')"
              @click="removeComment(c)"
            />
          </div>
        </div>

        <UEmpty
          v-else
          icon="i-lucide-message-circle"
          :title="t('speakingStudio.noCommentsYet')"
          variant="naked"
        />

        <!-- Comment Composer -->
        <form
          class="flex items-center gap-2 pt-2 border-t border-default"
          @submit.prevent="postComment"
        >
          <UInput
            v-model="commentDraft"
            :placeholder="t('speakingStudio.commentPlaceholder')"
            class="flex-1"
            data-testid="comment-input"
          />
          <UButton
            type="submit"
            icon="i-lucide-send"
            :label="t('speakingStudio.sendComment')"
            :loading="commentBusy"
            :disabled="!commentDraft.trim()"
            data-testid="comment-submit"
          />
        </form>
      </UCard>

      <!-- Likes & 0-9 Ratings Tab -->
      <div
        v-else
        class="flex flex-col gap-4"
        data-testid="speaking-reactions-panel"
      >
        <!-- Teacher Assessments -->
        <UCard
          variant="outline"
          :ui="{ body: 'flex flex-col gap-3' }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-award"
                class="size-4 text-success"
              />
              <p class="font-semibold text-highlighted text-sm">
                {{ t('speakingStudio.teacherAssessmentsTitle', { n: teacherAssessments.length }) }}
              </p>
            </div>
          </template>
          <div
            v-if="teacherAssessments.length"
            class="flex flex-col divide-y divide-default"
          >
            <div
              v-for="a in teacherAssessments"
              :key="a.id"
              class="py-2.5 first:pt-0 last:pb-0 flex flex-col gap-2"
            >
              <div class="flex items-center justify-between gap-2">
                <UUser
                  :name="a.author.name"
                  :description="localeDate(a.updatedAt, intlLocale(), { day: 'numeric', month: 'short' })"
                  :avatar="{ src: a.author.avatarUrl || undefined, alt: a.author.name }"
                  size="xs"
                />
                <UBadge
                  :label="`${a.overall} / 9`"
                  color="success"
                  variant="soft"
                  size="md"
                />
              </div>
              <div
                v-if="a.fluency != null || a.vocabulary != null || a.grammar != null || a.pronunciation != null"
                class="flex flex-wrap gap-1.5 ps-8"
              >
                <UBadge
                  v-if="a.fluency != null"
                  :label="`${t('speakingStudio.critFluency')}: ${a.fluency}/9`"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
                <UBadge
                  v-if="a.vocabulary != null"
                  :label="`${t('speakingStudio.critVocabulary')}: ${a.vocabulary}/9`"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
                <UBadge
                  v-if="a.grammar != null"
                  :label="`${t('speakingStudio.critGrammar')}: ${a.grammar}/9`"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
                <UBadge
                  v-if="a.pronunciation != null"
                  :label="`${t('speakingStudio.critPronunciation')}: ${a.pronunciation}/9`"
                  color="neutral"
                  variant="subtle"
                  size="xs"
                />
              </div>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('speakingStudio.noTeacherAssessments') }}
          </p>
        </UCard>

        <!-- Peer 0-9 Ratings -->
        <UCard
          variant="outline"
          :ui="{ body: 'flex flex-col gap-2' }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-star"
                class="size-4 text-warning"
              />
              <p class="font-semibold text-highlighted text-sm">
                {{ t('speakingStudio.peerRatingsTitle', { n: peerAssessments.length }) }}
              </p>
            </div>
          </template>
          <div
            v-if="peerAssessments.length"
            class="flex flex-col divide-y divide-default"
          >
            <div
              v-for="a in peerAssessments"
              :key="a.id"
              class="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2"
            >
              <UUser
                :name="a.author.name"
                :description="localeDate(a.updatedAt, intlLocale(), { day: 'numeric', month: 'short' })"
                :avatar="{ src: a.author.avatarUrl || undefined, alt: a.author.name }"
                size="xs"
              />
              <UBadge
                :label="`${a.overall} / 9`"
                icon="i-lucide-star"
                color="warning"
                variant="soft"
                size="sm"
              />
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('speakingStudio.noPeerRatings') }}
          </p>
        </UCard>

        <!-- Likes -->
        <UCard
          variant="outline"
          :ui="{ body: 'flex flex-col gap-2' }"
        >
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-heart"
                class="size-4 text-error"
              />
              <p class="font-semibold text-highlighted text-sm">
                {{ t('speakingStudio.likesTabTitle', { n: data.likes.length }) }}
              </p>
            </div>
          </template>
          <div
            v-if="data.likes.length"
            class="flex flex-col divide-y divide-default"
          >
            <div
              v-for="u in data.likes"
              :key="u.id"
              class="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2"
            >
              <UUser
                :name="u.name"
                :description="localeDate(u.createdAt, intlLocale(), { day: 'numeric', month: 'short' })"
                :avatar="{ src: u.avatarUrl || undefined, alt: u.name }"
                size="xs"
              />
              <UIcon
                name="i-lucide-heart"
                class="size-4 text-error"
              />
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('speakingStudio.noLikesYet') }}
          </p>
        </UCard>
      </div>
    </UContainer>

    <CourseSpeakingAssessModal
      v-model:open="assessOpen"
      :recording-id="recordingId"
      :speaker-name="data.recording.author.name"
      :is-teacher="data.teaches"
      :initial="data.recording.myAssessment ?? null"
      @saved="onAssessmentSaved"
    />
  </AppPage>
</template>
