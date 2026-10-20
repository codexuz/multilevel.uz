<script setup lang="ts">
import type { Section, SectionItem, Skill, Test } from '~/types/ielts'
import { libraryAPI } from '~/services/ielts'

/**
 * A test, put together from the library section by section. The server says what stops it being
 * published (errors) and where it departs from the official format (warnings); a mock must follow it.
 */
definePageMeta({ middleware: 'admin' })

const route = useRoute()
const toast = useToast()
const { confirm } = useDialogs()
const id = computed(() => String(route.params.id))

const { data: test, status, error } = useAsyncData<Test>(() => `test:${id.value}`, () => libraryAPI.test(id.value), { watch: [id] })
useSeoMeta({ title: () => `${test.value?.title ?? 'Test'} — Builder`, robots: 'noindex' })

// ─── Details ───────────────────────────────────────────────────────────────
const meta = reactive({ title: '', slug: '', description: '', mode: 'PRACTICE', access: 'FREE', category: null as string | null, source: '' })
watch(test, (t) => {
  if (!t) return
  Object.assign(meta, { title: t.title, slug: t.slug ?? '', description: t.description ?? '', mode: t.mode, access: t.access ?? 'FREE', category: t.category ?? null, source: t.source ?? '' })
}, { immediate: true })
const detailsDirty = computed(() => !!test.value && (meta.title !== test.value.title || meta.slug !== (test.value.slug ?? '') || meta.description !== (test.value.description ?? '') || meta.mode !== test.value.mode || meta.access !== (test.value.access ?? 'FREE')
  || meta.category !== (test.value.category ?? null) || meta.source !== (test.value.source ?? '')))

const saving = ref(false)
async function run(action: () => Promise<Test>, done?: string) {
  saving.value = true
  try {
    test.value = await action()
    if (done) toast.add({ title: done, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
const saveDetails = () => run(() => libraryAPI.updateTest(id.value, {
  title: meta.title.trim(), slug: meta.slug.trim() || undefined, description: meta.description.trim() || null, mode: meta.mode, access: meta.access, category: meta.category, source: meta.source.trim() || null
}), 'Saved')

// ─── Sections ──────────────────────────────────────────────────────────────
const sectionOf = (skill: Skill) => test.value?.sections.find(s => s.skill === skill)
const missingSkills = computed(() => SKILL_ORDER.filter(s => !sectionOf(s)))
const sections = computed(() => [...(test.value?.sections ?? [])].sort((a, b) => SKILL_ORDER.indexOf(a.skill) - SKILL_ORDER.indexOf(b.skill)))

const addSection = (skill: Skill) => run(() => libraryAPI.saveSection(id.value, skill, {}))
async function removeSection(s: Section) {
  if (!await confirm({ title: `Remove ${SKILL_META[s.skill].label}?`, description: 'The parts stay in the library; only this test loses them.', confirmLabel: 'Remove' })) return
  run(() => libraryAPI.removeSection(id.value, s.skill))
}

const sectionEdit = ref<Section | null>(null)
const sectionForm = reactive({ title: '', instructions: '', minutes: null as number | null, audioRef: null as string | null })
function editSection(s: Section) {
  sectionEdit.value = s
  Object.assign(sectionForm, { title: s.title ?? '', instructions: s.instructions ?? '', minutes: s.durationSeconds ? Math.round(s.durationSeconds / 60) : null, audioRef: s.audioRef ?? null })
}
async function saveSection() {
  const s = sectionEdit.value
  if (!s) return
  await run(() => libraryAPI.saveSection(id.value, s.skill, {
    title: sectionForm.title.trim() || null,
    instructions: sectionForm.instructions.trim() || null,
    durationSeconds: sectionForm.minutes ? sectionForm.minutes * 60 : null,
    audioRef: s.skill === 'LISTENING' ? sectionForm.audioRef : undefined
  }))
  sectionEdit.value = null
}

// Titles often start with their own label ("Task 1.1 — A letter"); it is shown once.
const withoutLabel = (title: string) => title.replace(/^(Task|Part) [\d.]+\s*[—-]\s*/, '')

function itemLabel(item: SectionItem) {
  if (item.part) return { title: `Part ${item.part.partNumber}${item.part.title ? ` — ${item.part.title}` : ''}`, sub: `${item.part.questionCount ?? item.part.groups?.flatMap(g => g.items).length ?? 0} questions${item.part.from ? ` · ${item.part.from}–${item.part.to}` : ''}`, to: `/builder/parts/${item.part.id}` }
  if (item.writingTask) return { title: `${writingTaskLabel(item.writingTask.taskNumber)}${item.writingTask.title ? ` — ${withoutLabel(item.writingTask.title)}` : ''}`, sub: (item.writingTask.prompt ?? '').replace(/<[^>]*>/g, ' ').trim().slice(0, 100), to: `/builder/writing/${item.writingTask.id}` }
  if (item.speakingPart) return { title: `${speakingPartLabel(item.speakingPart.partNumber)}${item.speakingPart.title ? ` — ${withoutLabel(item.speakingPart.title)}` : ''}`, sub: `${item.speakingPart.questions?.length ?? 0} questions`, to: `/builder/speaking/${item.speakingPart.id}` }
  return { title: 'Missing', sub: '', to: '' }
}

const removeItem = (item: SectionItem) => run(() => libraryAPI.removeItem(id.value, item.id))
function move(s: Section, index: number, delta: number) {
  const ids = s.items.map(i => i.id)
  const [moved] = ids.splice(index, 1)
  ids.splice(index + delta, 0, moved!)
  run(() => libraryAPI.reorderItems(id.value, s.skill, ids))
}

// ─── Adding from the library ───────────────────────────────────────────────
const picker = ref<Skill | null>(null)
const pickSearch = ref('')
const pickQ = ref('')
let pickTimer: ReturnType<typeof setTimeout> | undefined
watch(pickSearch, (v) => {
  clearTimeout(pickTimer)
  pickTimer = setTimeout(() => (pickQ.value = v), 300)
})
const { data: pickList, status: pickState } = useAsyncData(
  'test:picker',
  (): Promise<any> => {
    if (!picker.value) return Promise.resolve(null)
    const p = { limit: 30, search: pickQ.value || undefined }
    if (picker.value === 'WRITING') return libraryAPI.writingTasks(p)
    if (picker.value === 'SPEAKING') return libraryAPI.speakingParts(p)
    return libraryAPI.parts({ ...p, skill: picker.value })
  },
  { watch: [picker, pickQ] }
)
const inSection = computed(() => new Set((picker.value ? sectionOf(picker.value)?.items ?? [] : []).map(i => i.part?.id ?? i.writingTask?.id ?? i.speakingPart?.id)))
async function pick(row: any) {
  const skill = picker.value!
  const body = skill === 'WRITING' ? { writingTaskId: row.id } : skill === 'SPEAKING' ? { speakingPartId: row.id } : { partId: row.id }
  await run(() => libraryAPI.addItem(id.value, skill, body))
}
async function createAndOpen(skill: Skill) {
  const nextNumber = (sectionOf(skill)?.items.length ?? 0) + 1
  try {
    let target = ''
    if (skill === 'WRITING') {
      const task = await libraryAPI.createWritingTask({ taskNumber: Math.min(3, nextNumber), prompt: '<p>Write the question here.</p>' })
      await libraryAPI.addItem(id.value, skill, { writingTaskId: task.id })
      target = `/builder/writing/${task.id}`
    } else if (skill === 'SPEAKING') {
      const part = await libraryAPI.createSpeakingPart({ partNumber: Math.min(4, nextNumber), questions: [] })
      await libraryAPI.addItem(id.value, skill, { speakingPartId: part.id })
      target = `/builder/speaking/${part.id}`
    } else {
      const part = await libraryAPI.createPart({ skill, partNumber: Math.min(skill === 'LISTENING' ? 6 : 5, nextNumber), title: `${test.value?.title ?? ''} — ${SKILL_META[skill].label} ${nextNumber}`.slice(0, 300) })
      await libraryAPI.addItem(id.value, skill, { partId: part.id })
      target = `/builder/parts/${part.id}`
    }
    await navigateTo({ path: target, query: { test: id.value } })
  } catch (e) {
    toast.add({ title: 'Not created', description: errorMessage(e), color: 'error' })
  }
}

// ─── Publishing and the rest ───────────────────────────────────────────────
const publish = () => run(() => libraryAPI.publish(id.value), 'Published — anyone can take it, and search engines can find it')
const unpublish = () => run(() => libraryAPI.unpublish(id.value), 'Back to draft')
const archive = () => run(() => libraryAPI.archive(id.value), 'Archived')
async function duplicate() {
  try {
    const copy = await libraryAPI.duplicate(id.value)
    toast.add({ title: 'Copied', color: 'success' })
    await navigateTo(`/builder/tests/${copy.id}`)
  } catch (e) {
    toast.add({ title: 'Not copied', description: errorMessage(e), color: 'error' })
  }
}
async function exportJson() {
  try {
    const data = await libraryAPI.exportTest(id.value)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${(test.value?.title ?? 'test').replace(/[^\w-]+/g, '_')}.json` })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    toast.add({ title: 'Not exported', description: errorMessage(e), color: 'error' })
  }
}
async function remove() {
  if (!await confirm({ title: 'Delete this test?', description: 'A test somebody has sat is archived instead, so their results keep it.', confirmLabel: 'Delete' })) return
  try {
    const res: any = await libraryAPI.deleteTest(id.value)
    toast.add({ title: res?.archived ? 'Archived (it has attempts)' : 'Deleted', color: 'success' })
    await navigateTo('/builder')
  } catch (e) {
    toast.add({ title: 'Not deleted', description: errorMessage(e), color: 'error' })
  }
}
const menu = computed(() => [
  [
    ...(test.value?.status === 'PUBLISHED' && test.value.slug ? [{ label: 'Open public page', icon: 'i-lucide-external-link', to: `/tests/${test.value.slug}`, target: '_blank' }] : []),
    { label: 'Duplicate', icon: 'i-lucide-copy', onSelect: duplicate },
    { label: 'Export', icon: 'i-lucide-file-up', onSelect: exportJson }
  ],
  [
    ...(test.value?.status === 'PUBLISHED' ? [{ label: 'Back to draft', icon: 'i-lucide-undo-2', onSelect: unpublish }] : []),
    ...(test.value?.status !== 'ARCHIVED' ? [{ label: 'Archive', icon: 'i-lucide-archive', onSelect: archive }] : []),
    { label: 'Delete', icon: 'i-lucide-trash', color: 'error' as const, onSelect: remove }
  ]
])
const readiness = computed(() => test.value?.readiness ?? { errors: [], warnings: [] })
</script>

<template>
  <AppPage
    :title="test?.title ?? 'Test'"
    back="/builder"
  >
    <template #actions>
      <UBadge
        v-if="test"
        :label="STATUS_META[test.status]!.label"
        :color="STATUS_META[test.status]!.color"
        variant="subtle"
      />
      <UButton
        v-if="test && test.status !== 'PUBLISHED'"
        label="Publish"
        icon="i-lucide-send"
        :loading="saving"
        :disabled="readiness.errors.length > 0"
        @click="publish"
      />
      <UDropdownMenu
        v-if="test"
        :items="menu"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          square
        />
      </UDropdownMenu>
    </template>

    <div
      v-if="status === 'pending' && !test"
      class="grid gap-4"
    >
      <USkeleton class="h-40" /><USkeleton class="h-80" />
    </div>
    <UEmpty
      v-else-if="error"
      icon="i-lucide-circle-alert"
      title="This test could not be opened"
      :description="errorMessage(error)"
    />

    <div
      v-else-if="test"
      class="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start"
    >
      <div class="grid gap-4 min-w-0">
        <UCard
          v-for="s in sections"
          :key="s.id"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="SKILL_META[s.skill].icon"
                  class="size-5 text-muted"
                />
                <p class="font-semibold text-highlighted">
                  {{ s.title || SKILL_META[s.skill].label }}
                </p>
                <span class="text-xs text-muted">{{ minutesText(s.durationSeconds ?? s.officialSeconds) }}{{ s.durationSeconds ? '' : ' (official)' }}</span>
              </div>
              <div class="flex gap-1">
                <UButton
                  icon="i-lucide-settings-2"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  @click="editSection(s)"
                />
                <UButton
                  icon="i-lucide-trash"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  @click="removeSection(s)"
                />
              </div>
            </div>
            <p
              v-if="s.skill === 'LISTENING' && s.audioUrl"
              class="text-xs text-muted mt-1 flex items-center gap-1"
            >
              <UIcon name="i-lucide-file-audio" /> One recording for the whole section
            </p>
          </template>
          <ul class="divide-y divide-default">
            <li
              v-for="(item, i) in s.items"
              :key="item.id"
              class="px-4 py-2.5 flex items-center gap-3"
            >
              <div class="flex flex-col">
                <UButton
                  icon="i-lucide-chevron-up"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  :disabled="i === 0"
                  @click="move(s, i, -1)"
                />
                <UButton
                  icon="i-lucide-chevron-down"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  square
                  :disabled="i === s.items.length - 1"
                  @click="move(s, i, 1)"
                />
              </div>
              <NuxtLink
                :to="{ path: itemLabel(item).to, query: { test: id } }"
                class="min-w-0 flex-1 hover:underline"
              >
                <p class="text-sm font-medium truncate">{{ itemLabel(item).title }}</p>
                <p class="text-xs text-muted truncate">{{ itemLabel(item).sub }}</p>
              </NuxtLink>
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="neutral"
                variant="ghost"
                square
                @click="removeItem(item)"
              />
            </li>
          </ul>
          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                label="From the library"
                icon="i-lucide-library"
                size="sm"
                variant="soft"
                @click="picker = s.skill; pickSearch = ''"
              />
              <UButton
                :label="s.skill === 'WRITING' ? 'New task' : 'New part'"
                icon="i-lucide-plus"
                size="sm"
                color="neutral"
                variant="outline"
                @click="createAndOpen(s.skill)"
              />
            </div>
          </template>
        </UCard>

        <div
          v-if="missingSkills.length"
          class="flex flex-wrap gap-2"
        >
          <UButton
            v-for="skill in missingSkills"
            :key="skill"
            :label="`Add ${SKILL_META[skill].label}`"
            :icon="SKILL_META[skill].icon"
            color="neutral"
            variant="outline"
            @click="addSection(skill)"
          />
        </div>
      </div>

      <div class="grid gap-4 lg:sticky lg:top-4">
        <UCard>
          <template #header>
            <p class="font-semibold text-highlighted">
              Readiness
            </p>
          </template>
          <div
            v-if="!readiness.errors.length && !readiness.warnings.length"
            class="flex items-center gap-2 text-sm text-success"
          >
            <UIcon name="i-lucide-circle-check" /> Ready to publish
          </div>
          <ul class="grid gap-1.5 text-sm">
            <li
              v-for="(e, i) in readiness.errors"
              :key="`e${i}`"
              class="flex gap-2 text-error"
            >
              <UIcon
                name="i-lucide-circle-x"
                class="shrink-0 mt-0.5"
              />{{ e }}
            </li>
            <li
              v-for="(w, i) in readiness.warnings"
              :key="`w${i}`"
              class="flex gap-2 text-warning"
            >
              <UIcon
                name="i-lucide-triangle-alert"
                class="shrink-0 mt-0.5"
              />{{ w }}
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            <p class="font-semibold text-highlighted">
              Details
            </p>
          </template>
          <div class="grid gap-3">
            <UFormField
              label="Title"
              required
            >
              <UInput
                v-model="meta.title"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Description"
              :help="`Shown in Google results. ${meta.description.length}/160`"
            >
              <UTextarea
                v-model="meta.description"
                :rows="3"
                autoresize
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Address"
              :help="`multilevel.uz/tests/${meta.slug || '…'}`"
            >
              <UInput
                v-model="meta.slug"
                class="w-full"
              />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField
                label="Mode"
                help="A mock must follow the official format."
              >
                <USelect
                  v-model="meta.mode"
                  :items="MODE_ITEMS"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Category">
                <USelect
                  v-model="meta.category"
                  placeholder="None"
                  :items="CATEGORY_ITEMS"
                  class="w-full"
                />
              </UFormField>
            </div>
            <UFormField
              label="Access"
              help="Premium tests keep a public page; sitting them needs Premium."
            >
              <USelect
                v-model="meta.access"
                :items="[{ label: 'Free for everyone', value: 'FREE' }, { label: 'Premium', value: 'PREMIUM' }]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Source">
              <UInput
                v-model="meta.source"
                placeholder="Multilevel practice book, Test 1"
                class="w-full"
              />
            </UFormField>
            <UButton
              label="Save details"
              :loading="saving"
              :disabled="!detailsDirty || !meta.title.trim()"
              block
              @click="saveDetails"
            />
            <p
              v-if="test.attempts"
              class="text-xs text-muted"
            >
              {{ test.attempts }} attempts so far.
            </p>
          </div>
        </UCard>
      </div>
    </div>

    <USlideover
      :open="!!picker"
      :title="picker ? `Add to ${SKILL_META[picker].label}` : ''"
      @update:open="v => !v && (picker = null)"
    >
      <template #body>
        <div class="grid gap-3">
          <UInput
            v-model="pickSearch"
            icon="i-lucide-search"
            placeholder="Search the library"
            class="w-full"
          />
          <div
            v-if="pickState === 'pending'"
            class="grid gap-2"
          >
            <USkeleton
              v-for="i in 5"
              :key="i"
              class="h-12"
            />
          </div>
          <ul
            v-else
            class="divide-y divide-default"
          >
            <li
              v-for="row in pickList?.items ?? []"
              :key="row.id"
              class="py-2 flex items-center gap-3"
            >
              <UBadge
                :label="row.taskNumber ? writingTaskLabel(row.taskNumber) : picker === 'SPEAKING' ? speakingPartLabel(row.partNumber) : `Part ${row.partNumber}`"
                color="neutral"
                variant="soft"
              />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium truncate">
                  {{ row.title || (row.prompt ?? row.cueCard ?? '').replace(/<[^>]*>/g, ' ').trim().slice(0, 80) || 'Untitled' }}
                </p>
                <p
                  v-if="row.questionCount != null"
                  class="text-xs text-muted"
                >
                  {{ row.questionCount }} questions<span v-if="row.from"> · {{ row.from }}–{{ row.to }}</span>
                </p>
              </div>
              <UButton
                v-if="inSection.has(row.id)"
                label="Added"
                size="xs"
                color="neutral"
                variant="soft"
                disabled
              />
              <UButton
                v-else
                label="Add"
                size="xs"
                :loading="saving"
                @click="pick(row)"
              />
            </li>
            <li
              v-if="!pickList?.items?.length"
              class="py-6 text-center text-sm text-muted"
            >
              Nothing matches.
            </li>
          </ul>
        </div>
      </template>
    </USlideover>

    <UModal
      :open="!!sectionEdit"
      :title="sectionEdit ? `${SKILL_META[sectionEdit.skill].label} settings` : ''"
      @update:open="v => !v && (sectionEdit = null)"
    >
      <template #body>
        <div
          v-if="sectionEdit"
          class="grid gap-4"
        >
          <UFormField label="Title">
            <UInput
              v-model="sectionForm.title"
              :placeholder="SKILL_META[sectionEdit.skill].label"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Instructions to candidates">
            <UTextarea
              v-model="sectionForm.instructions"
              :rows="3"
              autoresize
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Time (minutes)"
            :help="`Official: ${minutesText(sectionEdit.officialSeconds)}. Leave empty for the official time.`"
          >
            <UInputNumber
              v-model="sectionForm.minutes"
              :min="1"
              :max="240"
              class="w-36"
            />
          </UFormField>
          <UFormField
            v-if="sectionEdit.skill === 'LISTENING'"
            label="Whole-section recording"
            help="Optional: one file for all six parts, instead of one per part."
          >
            <BuilderFileField
              v-model="sectionForm.audioRef"
              kind="audio"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="() => { sectionEdit = null }"
          />
          <UButton
            label="Save"
            :loading="saving"
            @click="saveSection"
          />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
