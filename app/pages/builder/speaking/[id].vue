<script setup lang="ts">
import type { SpeakingPart } from '~/types/ielts'
import { libraryAPI } from '~/services/ielts'

/** A Multilevel Speaking part: its questions, the pictures for Parts 1.2 and 2, and the debate table for Part 3. */
definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { confirm } = useDialogs()
const id = computed(() => String(route.params.id))
const back = computed(() => (route.query.test ? `/builder/tests/${route.query.test}` : '/builder?tab=speaking'))

const { data: part, status, error } = useAsyncData<SpeakingPart>(() => `speaking-part:${id.value}`, () => libraryAPI.speakingPart(id.value), { watch: [id] })
useSeoMeta({ title: () => `${part.value?.title || 'Speaking part'} — Builder`, robots: 'noindex' })

const form = reactive({ partNumber: 1 as 1 | 2 | 3 | 4, title: '', cueCard: '', imageRef: null as string | null, prepSeconds: null as number | null, speakSeconds: null as number | null, questions: [] as string[] })

const payload = () => ({
  partNumber: form.partNumber, title: form.title.trim() || null, cueCard: form.cueCard.trim() || null, imageRef: form.imageRef,
  prepSeconds: form.prepSeconds, speakSeconds: form.speakSeconds,
  questions: form.questions.map(q => q.trim()).filter(Boolean)
})
const autosave = useAutosave(payload, async () => {
  const saved = await libraryAPI.updateSpeakingPart(id.value, payload())
  if (part.value) part.value.imageUrl = saved.imageUrl
})
watch(part, (p, old) => {
  if (!p || p.id === old?.id) return
  Object.assign(form, {
    partNumber: p.partNumber as 1 | 2 | 3 | 4, title: p.title ?? '', cueCard: p.cueCard ?? '', imageRef: p.imageRef ?? null, prepSeconds: p.prepSeconds ?? null, speakSeconds: p.speakSeconds ?? null,
    questions: [...p.questions].sort((a, b) => a.position - b.position).map(q => q.text)
  })
  nextTick(() => autosave.markClean())
}, { immediate: true })
watch(autosave.state, (s) => { if (s === 'error') toast.add({ title: 'Changes not saved', color: 'error' }) })

const newQuestion = ref('')
function addQuestion() {
  if (!newQuestion.value.trim()) return
  form.questions.push(newQuestion.value.trim())
  newQuestion.value = ''
}
function move(i: number, d: number) {
  const [q] = form.questions.splice(i, 1)
  form.questions.splice(i + d, 0, q!)
}

async function remove() {
  if (!await confirm({ title: 'Delete this Speaking part?', description: 'A part used in a test cannot be deleted.', confirmLabel: 'Delete' })) return
  try {
    await libraryAPI.deleteSpeakingPart(id.value)
    await navigateTo(back.value)
  } catch (e) {
    toast.add({ title: 'Not deleted', description: errorMessage(e), color: 'error' })
  }
}
const saveLabel = computed(() => ({ idle: '', dirty: 'Unsaved changes', saving: 'Saving…', saved: 'Saved', error: 'Not saved' })[autosave.state.value])
const hint = computed(() => ({
  1: 'Part 1.1: three questions about the candidate — 5 seconds to think, 30 seconds to answer each.',
  2: 'Part 1.2: two pictures to compare, then questions about them — 10 seconds to think, 30–45 seconds each.',
  3: 'Part 2: a picture and a cue card — one minute to prepare, two minutes to speak.',
  4: 'Part 3: a debate topic with points for and against — one minute to prepare, two minutes to speak.'
} as Record<number, string>)[form.partNumber])
</script>

<template>
  <AppPage
    :title="part ? (part.title || `Speaking ${speakingPartLabel(part.partNumber)}`) : 'Speaking part'"
    :back="back"
    wide
  >
    <template #actions>
      <span class="text-xs text-muted max-sm:hidden">{{ saveLabel }}</span>
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
      <USkeleton class="h-80" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-circle-alert"
      title="This part could not be opened"
      :description="errorMessage(error)"
    />
    <div
      v-else-if="part"
      class="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start"
    >
      <div class="grid gap-4 min-w-0">
        <UAlert
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          :description="hint"
        />
        <UCard v-if="form.partNumber !== 1">
          <template #header>
            <p class="font-semibold text-highlighted">
              {{ form.partNumber === 2 ? 'Pictures' : 'Picture' }}
            </p>
          </template>
          <BuilderFileField
            v-model="form.imageRef"
            kind="image"
            :url="part.imageUrl"
          />
        </UCard>
        <UCard v-if="form.partNumber >= 3">
          <template #header>
            <p class="font-semibold text-highlighted">
              {{ form.partNumber === 4 ? 'Debate table' : 'Cue card' }}
            </p>
          </template>
          <BuilderRichEditor
            v-model="form.cueCard"
            toolbar="basic"
            :placeholder="form.partNumber === 4 ? 'The topic, with a table of points For and Against.' : 'The topic and the points to talk about.'"
            min-height="min-h-40"
          />
        </UCard>
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <template #header>
            <p class="font-semibold text-highlighted">
              Questions
            </p>
          </template>
          <ol class="divide-y divide-default">
            <li
              v-for="(q, i) in form.questions"
              :key="i"
              class="px-4 py-2 flex items-center gap-2"
            >
              <span class="text-xs text-muted tabular-nums w-5">{{ i + 1 }}.</span>
              <UInput
                v-model="form.questions[i]"
                variant="none"
                class="flex-1"
              />
              <UButton
                icon="i-lucide-chevron-up"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                :disabled="i === 0"
                @click="move(i, -1)"
              />
              <UButton
                icon="i-lucide-chevron-down"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                :disabled="i === form.questions.length - 1"
                @click="move(i, 1)"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                @click="() => { form.questions.splice(i, 1) }"
              />
            </li>
          </ol>
          <template #footer>
            <div class="flex gap-2">
              <UInput
                v-model="newQuestion"
                placeholder="Type a question and press Enter"
                class="flex-1"
                @keydown.enter.prevent="addQuestion"
              />
              <UButton
                icon="i-lucide-plus"
                label="Add"
                :disabled="!newQuestion.trim()"
                @click="addQuestion"
              />
            </div>
          </template>
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
          <UFormField label="Part">
            <USelect
              v-model="form.partNumber"
              :items="[1, 2, 3, 4].map(n => ({ label: speakingPartLabel(n), value: n }))"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Preparation (seconds)"
            help="Per question in Parts 1.1 and 1.2."
          >
            <UInputNumber
              v-model="form.prepSeconds"
              :min="0"
              :max="600"
              :placeholder="form.partNumber >= 3 ? '60' : '5'"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Speaking time (seconds)">
            <UInputNumber
              v-model="form.speakSeconds"
              :min="0"
              :max="900"
              :placeholder="form.partNumber >= 3 ? '120' : '30'"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>
    </div>
  </AppPage>
</template>
