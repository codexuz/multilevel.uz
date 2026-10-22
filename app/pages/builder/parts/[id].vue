<script setup lang="ts">
import type { Part, QuestionGroup } from '~/types/ielts'
import { libraryAPI } from '~/services/ielts'

/**
 * A Listening part or Reading passage: the recording or the text, and its question groups. It lives
 * in the library, so every test that uses it gets the same questions; answered questions cannot be
 * removed, so results already given stay true.
 */
definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { confirm } = useDialogs()
const id = computed(() => String(route.params.id))
const back = computed(() => (route.query.test ? `/builder/tests/${route.query.test}` : `/builder?tab=${part.value?.skill === 'LISTENING' ? 'listening' : 'reading'}`))

const { data: part, status, error } = useAsyncData<Part>(() => `part:${id.value}`, () => libraryAPI.part(id.value), { watch: [id] })
useSeoMeta({ title: () => `${part.value?.title || 'Part'} — Builder`, robots: 'noindex' })

const form = reactive({
  partNumber: 1, title: '', passage: '', audioRef: null as string | null, transcriptRef: null as string | null,
  difficulty: null as string | null, timeLimitMinutes: null as number | null, isActive: true
})
const editorKey = ref(0)
function fill(p: Part) {
  Object.assign(form, {
    partNumber: p.partNumber, title: p.title ?? '', passage: p.passage ?? '', audioRef: p.audioRef ?? null, transcriptRef: p.transcriptRef ?? null,
    difficulty: p.difficulty ?? null, timeLimitMinutes: p.timeLimitMinutes ?? null, isActive: p.isActive !== false
  })
  editorKey.value++
}
watch(part, (p, old) => { if (p && p.id !== old?.id) fill(p) }, { immediate: true })

const listening = computed(() => part.value?.skill === 'LISTENING')
const payload = () => ({
  partNumber: form.partNumber, title: form.title.trim(), passage: listening.value ? null : form.passage,
  audioRef: listening.value ? form.audioRef : null, transcriptRef: listening.value ? form.transcriptRef : null,
  difficulty: form.difficulty, timeLimitMinutes: form.timeLimitMinutes, isActive: form.isActive
})
const autosave = useAutosave(payload, async () => {
  const saved = await libraryAPI.updatePart(id.value, payload())
  if (part.value) Object.assign(part.value, { audioUrl: saved.audioUrl, transcriptUrl: saved.transcriptUrl, tests: saved.tests })
})
watch(part, (p, old) => { if (p && p.id !== old?.id) nextTick(() => autosave.markClean()) }, { immediate: true })
watch(autosave.state, (s) => { if (s === 'error') toast.add({ title: 'Changes not saved', description: 'Check your connection; saving again on the next change.', color: 'error' }) })

// ─── Question groups ───────────────────────────────────────────────────────
const groups = computed(() => [...(part.value?.groups ?? [])].sort((a, b) => a.position - b.position))
const numbers = computed(() => groups.value.flatMap(g => g.items.map(i => i.number)))
const nextNumber = computed(() => (numbers.value.length ? Math.max(...numbers.value) + 1 : suggestedStart.value))
// Where each Multilevel part's numbering starts: Listening 1, 9, 15, 19, 24, 30; Reading 1, 7, 15, 21, 30.
// Where the numbering usually starts: IELTS Listening 1, 11, 21, 31; Reading 1, 14, 27 (roughly 13 a passage).
const suggestedStart = computed(() => (part.value?.exam === 'IELTS'
  ? (listening.value ? [1, 11, 21, 31] : [1, 14, 27])
  : (listening.value ? [1, 9, 15, 19, 24, 30] : [1, 7, 15, 21, 30]))[form.partNumber - 1] ?? 1)
const unkeyed = computed(() => groups.value.flatMap(g => g.items).filter(i => !(i.acceptedAnswers ?? []).length).map(i => i.number))

const editorOpen = ref(false)
const editing = ref<QuestionGroup | null>(null)
function addGroup() {
  editing.value = null
  editorOpen.value = true
}
function editGroup(g: QuestionGroup) {
  editing.value = g
  editorOpen.value = true
}
function onSaved(p: Part) {
  if (part.value) part.value.groups = p.groups
}
async function deleteGroup(g: QuestionGroup) {
  if (!await confirm({ title: `Delete questions ${g.from}–${g.to}?`, description: 'Questions somebody has answered cannot be deleted.', confirmLabel: 'Delete' })) return
  try {
    onSaved(await libraryAPI.deleteGroup(g.id))
  } catch (e) {
    toast.add({ title: 'Not deleted', description: errorMessage(e), color: 'error' })
  }
}
async function moveGroup(index: number, delta: number) {
  const ids = groups.value.map(g => g.id)
  const [moved] = ids.splice(index, 1)
  ids.splice(index + delta, 0, moved!)
  try {
    onSaved(await libraryAPI.reorderGroups(id.value, ids))
  } catch (e) {
    toast.add({ title: 'Not moved', description: errorMessage(e), color: 'error' })
  }
}

async function remove() {
  if (!await confirm({ title: 'Delete this part?', description: 'A part in a test or with answers is made inactive instead.', confirmLabel: 'Delete' })) return
  try {
    const res = await libraryAPI.deletePart(id.value)
    toast.add({ title: res.archived ? 'Made inactive (it is in use)' : 'Deleted', color: 'success' })
    await navigateTo(back.value)
  } catch (e) {
    toast.add({ title: 'Not deleted', description: errorMessage(e), color: 'error' })
  }
}

const preview = ref(false)
const previewAnswers = ref<Record<number, string>>({})
const renderGroups = computed(() => groups.value.map(toRenderQuestion))
const saveLabel = computed(() => ({ idle: '', dirty: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: 'Not saved' })[autosave.state.value])
</script>

<template>
  <AppPage
    :title="part?.title || (listening ? 'Listening part' : 'Reading passage')"
    :back="back"
    wide
  >
    <template #actions>
      <span class="text-xs text-muted max-sm:hidden">{{ saveLabel }}</span>
      <UButton
        :label="preview ? 'Edit' : 'Preview'"
        :icon="preview ? 'i-lucide-pencil' : 'i-lucide-eye'"
        color="neutral"
        variant="outline"
        size="sm"
        @click="() => { preview = !preview }"
      />
      <UButton
        icon="i-lucide-trash"
        color="neutral"
        variant="ghost"
        square
        @click="remove"
      />
    </template>

    <div
      v-if="status === 'pending' && !part"
      class="grid gap-4"
    >
      <USkeleton class="h-40" /><USkeleton class="h-80" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-circle-alert"
      title="This part could not be opened"
      :description="errorMessage(error)"
    />

    <!-- Preview: as a candidate sees it, with the keys shown -->
    <div
      v-else-if="part && preview"
      class="grid lg:grid-cols-2 gap-6 items-start"
    >
      <UCard>
        <AudioPlayer
          v-if="listening && part.audioUrl"
          :src="mediaUrl(part.audioUrl)"
        />
        <div
          v-else-if="!listening"
          class="rich-content reading-passage leading-7"
          v-html="form.passage"
        />
      </UCard>
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <ExamQuestionPanel
          :questions="renderGroups"
          :answers="previewAnswers"
          show-results
          @answer="(n, v) => (previewAnswers = { ...previewAnswers, [n]: v })"
        />
      </UCard>
    </div>

    <div
      v-else-if="part"
      class="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start"
    >
      <div class="grid gap-4 min-w-0">
        <UCard v-if="listening">
          <template #header>
            <p class="font-semibold text-highlighted">
              Recording
            </p>
          </template>
          <div class="grid gap-4">
            <UFormField
              label="Audio"
              help="MP3 or M4A. Candidates hear it once, as in the real test."
            >
              <BuilderFileField
                v-model="form.audioRef"
                kind="audio"
                :url="part.audioUrl"
              />
            </UFormField>
            <UFormField
              label="Transcript"
              help="WebVTT (follows the recording), plain text or PDF. Shown in the review, never during the test."
            >
              <BuilderFileField
                v-model="form.transcriptRef"
                kind="document"
                accept=".vtt,.txt,.pdf"
                :url="part.transcriptUrl"
              />
            </UFormField>
          </div>
        </UCard>
        <UCard v-else>
          <template #header>
            <p class="font-semibold text-highlighted">
              Passage
            </p>
          </template>
          <BuilderRichEditor
            :key="editorKey"
            v-model="form.passage"
            placeholder="Paste or write the passage. Label paragraphs A, B, C… for matching tasks."
            min-height="min-h-80"
          />
        </UCard>

        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="font-semibold text-highlighted">
                  Questions
                </p>
                <p class="text-xs text-muted">
                  {{ numbers.length }} questions<span v-if="numbers.length"> · {{ Math.min(...numbers) }}–{{ Math.max(...numbers) }}</span>
                </p>
              </div>
              <UButton
                label="Add questions"
                icon="i-lucide-plus"
                size="sm"
                @click="addGroup"
              />
            </div>
          </template>
          <UAlert
            v-if="unkeyed.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-key-round"
            :title="`No answer key for ${unkeyed.join(', ')}`"
            class="rounded-none"
          />
          <ul class="divide-y divide-default">
            <li
              v-for="(g, i) in groups"
              :key="g.id"
              class="px-4 py-3 flex items-start gap-3"
            >
              <div class="flex flex-col">
                <UButton
                  icon="i-lucide-chevron-up"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  :disabled="i === 0"
                  @click="moveGroup(i, -1)"
                />
                <UButton
                  icon="i-lucide-chevron-down"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  :disabled="i === groups.length - 1"
                  @click="moveGroup(i, 1)"
                />
              </div>
              <UIcon
                :name="questionTypeIcon(g.type)"
                class="size-5 text-muted mt-1.5 shrink-0"
              />
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="editGroup(g)"
              >
                <p class="text-sm font-medium">
                  Questions {{ g.from }}<span v-if="g.to !== g.from">–{{ g.to }}</span> · {{ questionTypeLabel(g.type) }}
                </p>
                <p class="text-xs text-muted truncate">
                  {{ g.items.map(it => `${it.number}: ${(it.acceptedAnswers ?? []).join(' / ') || '—'}`).join(' · ') }}
                </p>
              </button>
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                @click="editGroup(g)"
              />
              <UButton
                icon="i-lucide-trash"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                @click="deleteGroup(g)"
              />
            </li>
            <li
              v-if="!groups.length"
              class="p-8"
            >
              <UEmpty
                icon="i-lucide-list-checks"
                title="No questions yet"
                :description="`Numbering usually starts at ${suggestedStart} for Part ${form.partNumber}.`"
                variant="naked"
              />
            </li>
          </ul>
        </UCard>
      </div>

      <UCard class="lg:sticky lg:top-4">
        <template #header>
          <p class="font-semibold text-highlighted">
            Details
          </p>
        </template>
        <div class="grid gap-3">
          <UFormField label="Title">
            <UInput
              v-model="form.title"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Part">
              <USelect
                v-model="form.partNumber"
                :items="partNumbersOf(part?.exam, listening ? 'LISTENING' : 'READING').map(n => ({ label: `Part ${n}`, value: n }))"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Difficulty">
              <USelect
                v-model="form.difficulty"
                placeholder="—"
                :items="[{ label: '—', value: null }, ...DIFFICULTY_ITEMS]"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Practice time (minutes)"
            help="When sat on its own. Empty for the usual time."
          >
            <UInputNumber
              v-model="form.timeLimitMinutes"
              :min="1"
              :max="180"
              class="w-32"
            />
          </UFormField>
          <USwitch
            v-model="form.isActive"
            label="Offered for practice"
          />
          <div
            v-if="part.tests?.length"
            class="pt-2 border-t border-default"
          >
            <p class="text-xs text-muted mb-1">
              Used in
            </p>
            <ul class="grid gap-1">
              <li
                v-for="t in part.tests"
                :key="t.id"
              >
                <NuxtLink
                  :to="`/builder/tests/${t.id}`"
                  class="text-sm text-primary hover:underline"
                >{{ t.title }}</NuxtLink>
                <UBadge
                  :label="STATUS_META[t.status]!.label"
                  :color="STATUS_META[t.status]!.color"
                  variant="soft"
                  size="sm"
                  class="ml-2"
                />
              </li>
            </ul>
          </div>
        </div>
      </UCard>
    </div>

    <BuilderQuestionEditor
      v-if="part"
      v-model:open="editorOpen"
      :part-id="part.id"
      :group="editing"
      :next-number="nextNumber"
      @saved="onSaved"
    />
  </AppPage>
</template>
