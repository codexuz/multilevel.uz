<script setup lang="ts">
/**
 * Marking one Writing or Speaking attempt: the tasks and what was written (or the recordings) on one
 * side; the score out of 75, a word for the candidate and a comment on each essay on the other.
 */
definePageMeta({ middleware: 'staff' })

const route = useRoute()
const toast = useToast()
const id = computed(() => String(route.params.id))
const { data: attempt, status, error } = await useFetch<any>(() => `/api/admin/marking/${id.value}`)
useSeoMeta({ title: () => `Marking${attempt.value?.user ? ` — ${attempt.value.user.name}` : ''}`, robots: 'noindex' })

const section = computed(() => attempt.value?.review?.sections?.[0] ?? null)
const tasks = computed<any[]>(() => section.value?.tasks ?? [])
const speaking = computed<any[]>(() => section.value?.speaking ?? [])
const recordingFor = (partId: string) => attempt.value?.recordings?.find((r: any) => r.partId === partId) ?? null

const score = ref<number | null>(null)
const feedback = ref('')
const essayFeedback = reactive<Record<string, string>>({})
watch(attempt, (a) => {
  if (!a) return
  score.value = a.score ?? null
  feedback.value = a.feedback ?? ''
  for (const t of a.review?.sections?.[0]?.tasks ?? []) if (t.essay) essayFeedback[t.essay.id] = t.essay.feedback ?? ''
}, { immediate: true })

const saving = ref(false)
async function grade(next: boolean) {
  if (score.value == null) return
  saving.value = true
  try {
    attempt.value = await $fetch(`/api/admin/marking/${id.value}`, {
      method: 'POST',
      body: { score: score.value, feedback: feedback.value.trim() || null, essays: Object.entries(essayFeedback).map(([essayId, text]) => ({ id: essayId, feedback: text })) }
    })
    toast.add({ title: 'Marked', description: `${score.value} / 75 · ${cefrOf(score.value)}. The candidate has been told.`, color: 'success' })
    if (next) {
      const queue = await $fetch<any>('/api/admin/marking', { query: { status: 'SUBMITTED', limit: 5 } })
      const following = queue.items.find((a: any) => a.id !== id.value)
      return navigateTo(following ? `/marking/${following.id}` : '/marking')
    }
  } catch (e: any) {
    toast.add({ title: 'Not marked', description: e?.data?.message || e?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppPage
    :title="attempt ? `${skillLabel(attempt.skill)} — ${attempt.user?.name ?? ''}` : 'Marking'"
    back="/marking"
  >
    <template #actions>
      <UBadge
        v-if="attempt?.status === 'GRADED'"
        label="Marked"
        color="success"
        variant="subtle"
      />
    </template>

    <div
      v-if="status === 'pending' && !attempt"
      class="grid gap-4"
    >
      <USkeleton class="h-80" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-circle-alert"
      title="This attempt could not be opened"
      :actions="[{ label: 'Back to marking', to: '/marking' }]"
    />

    <div
      v-else-if="attempt"
      class="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start"
    >
      <div class="grid gap-4 min-w-0">
        <p class="text-sm text-muted">
          {{ attempt.test?.title }} · handed in {{ relativeTime(attempt.submittedAt) }}
        </p>

        <UCard
          v-for="t in tasks"
          :key="t.task.id"
        >
          <template #header>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-semibold">{{ writingTaskLabel(t.task.taskNumber) }}</span>
              <UBadge
                v-if="t.essay"
                :label="`${t.essay.wordCount} words`"
                :color="t.essay.wordCount < t.task.minWords ? 'warning' : 'primary'"
                variant="soft"
                size="sm"
                class="ms-auto"
              />
              <UBadge
                :label="`At least ${t.task.minWords}`"
                color="neutral"
                variant="outline"
                size="sm"
              />
            </div>
          </template>
          <div
            class="rich-content text-sm text-muted leading-6 mb-4"
            v-html="t.task.prompt"
          />
          <p
            v-if="t.essay?.text"
            class="whitespace-pre-wrap leading-7 font-serif"
          >
            {{ t.essay.text }}
          </p>
          <p
            v-else
            class="text-sm text-muted"
          >
            Nothing was written.
          </p>
          <template
            v-if="t.essay"
            #footer
          >
            <UFormField label="Comment on this task">
              <UTextarea
                v-model="essayFeedback[t.essay.id]"
                :rows="2"
                autoresize
                class="w-full"
              />
            </UFormField>
          </template>
        </UCard>

        <UCard
          v-for="p in speaking"
          :key="p.id"
        >
          <template #header>
            <span class="font-semibold">{{ speakingPartLabel(p.partNumber) }}<span v-if="p.title"> — {{ p.title }}</span></span>
          </template>
          <img
            v-if="p.imageUrl"
            :src="p.imageUrl"
            alt=""
            class="rounded-md max-h-56 mb-3 border border-default"
          >
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
            :src="recordingFor(p.id).audioUrl"
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

      <UCard class="lg:sticky lg:top-4">
        <template #header>
          <p class="font-semibold text-highlighted">
            Mark
          </p>
        </template>
        <div class="grid gap-4">
          <UFormField
            label="Score (0–75)"
            required
            :help="score != null ? `CEFR ${cefrOf(score) === 'A2' ? 'below B1' : cefrOf(score)}` : 'B1 from 38, B2 from 51, C1 from 65.'"
          >
            <UInputNumber
              v-model="score"
              :min="0"
              :max="75"
              class="w-36"
            />
          </UFormField>
          <UFormField label="Feedback for the candidate">
            <UTextarea
              v-model="feedback"
              :rows="6"
              autoresize
              class="w-full"
            />
          </UFormField>
          <div class="grid gap-2">
            <UButton
              label="Save and next"
              icon="i-lucide-arrow-right"
              :loading="saving"
              :disabled="score == null"
              block
              @click="() => { grade(true) }"
            />
            <UButton
              label="Save"
              color="neutral"
              variant="outline"
              :loading="saving"
              :disabled="score == null"
              block
              @click="() => { grade(false) }"
            />
          </div>
          <p
            v-if="attempt.examiner"
            class="text-xs text-muted"
          >
            Marked by {{ attempt.examiner.name }}.
          </p>
        </div>
      </UCard>
    </div>
  </AppPage>
</template>
