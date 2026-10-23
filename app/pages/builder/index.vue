<script setup lang="ts">
import type { Part, SpeakingPart, TestSummary, WritingTask } from '~/types/ielts'
import { libraryAPI } from '~/services/ielts'

/**
 * The library (the IELTS addon's builder). Parts, writing tasks and speaking parts are written once
 * and reused; a test is a paper put together from them, section by section. One exam at a time:
 * IELTS and Multilevel number their parts and tasks differently, so each has its own library.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Test builder', robots: 'noindex' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { prompt, confirm } = useDialogs()

const TABS = [
  { label: 'Tests', value: 'tests', icon: 'i-lucide-files' },
  { label: 'Listening', value: 'listening', icon: SKILL_META.LISTENING.icon },
  { label: 'Reading', value: 'reading', icon: SKILL_META.READING.icon },
  { label: 'Writing', value: 'writing', icon: SKILL_META.WRITING.icon },
  { label: 'Speaking', value: 'speaking', icon: SKILL_META.SPEAKING.icon }
]
// The list as it is (tab, page, search and filters) lives in the address: going into a test or a
// part and back, or the browser's back, opens the same page of the same list.
const tabOf = (v: unknown) => (TABS.some(t => t.value === v) ? String(v) : 'tests')
const str = (v: unknown, fallback = '') => (typeof v === 'string' && v ? v : fallback)
const tab = ref(tabOf(route.query.tab))
const page = ref(Math.max(1, Number(route.query.page) || 1))
const search = ref(str(route.query.q))
const q = ref(search.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (q.value = v.trim()), 300)
})
// 'ALL' rather than empty: a select cannot hold an empty value.
const testStatus = ref(str(route.query.status, 'ALL'))
/** Tests with all four skills (FULL), or not yet (PARTIAL). */
const completeness = ref(str(route.query.full, 'ALL'))
const completenessItems = [{ label: 'Full or not', value: 'ALL' }, { label: 'Full tests', value: 'FULL' }, { label: 'Not full', value: 'PARTIAL' }]
/** Library items placed in a test (IN_TEST), or in none yet (UNUSED). */
const used = ref(str(route.query.used, 'ALL'))
const usedItems = [{ label: 'In tests or not', value: 'ALL' }, { label: 'In a test', value: 'IN_TEST' }, { label: 'Not in a test', value: 'UNUSED' }]
watch([tab, page, q, testStatus, completeness, used], () => router.replace({
  query: {
    tab: tab.value === 'tests' ? undefined : tab.value,
    page: page.value > 1 ? String(page.value) : undefined,
    q: q.value || undefined,
    status: tab.value === 'tests' && testStatus.value !== 'ALL' ? testStatus.value : undefined,
    full: tab.value === 'tests' && completeness.value !== 'ALL' ? completeness.value : undefined,
    used: tab.value !== 'tests' && used.value !== 'ALL' ? used.value : undefined
  }
}))
// Kept for the editors' back arrows (useBuilderList).
const lastList = useBuilderList()
watch(() => route.fullPath, (path) => {
  if (route.path === '/builder') lastList.value = path
}, { immediate: true })
// The sidebar's link (or another page) changing the address while this page is open.
watch(() => route.query, (rq) => {
  if (route.path !== '/builder') return
  if (tab.value !== tabOf(rq.tab)) tab.value = tabOf(rq.tab)
  if (page.value !== Math.max(1, Number(rq.page) || 1)) page.value = Math.max(1, Number(rq.page) || 1)
  if (q.value !== str(rq.q)) search.value = q.value = str(rq.q)
  if (testStatus.value !== str(rq.status, 'ALL')) testStatus.value = str(rq.status, 'ALL')
  if (completeness.value !== str(rq.full, 'ALL')) completeness.value = str(rq.full, 'ALL')
  if (used.value !== str(rq.used, 'ALL')) used.value = str(rq.used, 'ALL')
})
// Staff build for either exam: the library's own choice, apart from the exam they prepare for.
const builderExam = useCookie<string | null>('builder-exam', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const exam = computed<Exam>(() => (isExam(builderExam.value) ? builderExam.value : 'IELTS'))
const setExam = (next: Exam) => (builderExam.value = next)
// Another list (or filter) starts on its first page.
watch([tab, q, testStatus, completeness, used, exam], () => (page.value = 1))
// ─── Many tests at once: pick them, then one action for them all ───
const picked = ref<string[]>([])
watch([tab, q, testStatus, completeness, used, exam, page], () => (picked.value = []))
const pageTests = computed(() => (tab.value === 'tests' ? ((data.value?.items ?? []) as { id: string }[]).map(x => x.id) : []))
const allPicked = computed(() => pageTests.value.length > 0 && pageTests.value.every(id => picked.value.includes(id)))
const togglePick = (id: string, on: boolean) => (picked.value = on ? [...new Set([...picked.value, id])] : picked.value.filter(x => x !== id))
const bulkBusy = ref(false)
const BULK_DONE: Record<string, string> = { PUBLISH: 'published', DRAFT: 'moved to draft', ARCHIVE: 'archived', DELETE: 'deleted', FREE: 'made free', PREMIUM: 'made Premium' }
async function bulk(action: 'PUBLISH' | 'DRAFT' | 'ARCHIVE' | 'DELETE' | 'FREE' | 'PREMIUM') {
  const n = picked.value.length
  if (!n) return
  if (action === 'DELETE' && !await confirm({ title: `Delete ${n} test${n === 1 ? '' : 's'}?`, description: 'A test somebody sat stays (archive it instead). This cannot be undone.', confirmLabel: 'Delete', color: 'error' })) return
  bulkBusy.value = true
  try {
    const res = await $fetch<{ done: number, failed: { title: string, message: string }[] }>('/api/admin/tests/bulk', { method: 'POST', body: { ids: picked.value, action } })
    toast.add({
      title: `${res.done} test${res.done === 1 ? '' : 's'} ${BULK_DONE[action]}`,
      description: res.failed.length ? res.failed.slice(0, 4).map(f => `${f.title}: ${f.message}`).join(' · ') + (res.failed.length > 4 ? ` · and ${res.failed.length - 4} more` : '') : undefined,
      color: res.failed.length ? 'warning' : 'success'
    })
    picked.value = []
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not done', description: errorMessage(e), color: 'error' })
  } finally {
    bulkBusy.value = false
  }
}

const { data, status, refresh } = useAsyncData(
  'builder:list',
  (): Promise<any> => {
    const p = { page: page.value, limit: 20, search: q.value || undefined, exam: exam.value, used: used.value === 'ALL' ? undefined : used.value }
    if (tab.value === 'tests') {
      return libraryAPI.tests({
        ...p, status: testStatus.value === 'ALL' ? undefined : testStatus.value,
        full: completeness.value === 'FULL' ? '1' : completeness.value === 'PARTIAL' ? '0' : undefined
      })
    }
    if (tab.value === 'listening') return libraryAPI.parts({ ...p, skill: 'LISTENING' })
    if (tab.value === 'reading') return libraryAPI.parts({ ...p, skill: 'READING' })
    if (tab.value === 'writing') return libraryAPI.writingTasks(p)
    return libraryAPI.speakingParts(p)
  },
  { watch: [tab, page, q, testStatus, completeness, used, exam], lazy: true }
)

// ─── Creating ──────────────────────────────────────────────────────────────
const creating = ref(false)
async function create(kind: string) {
  creating.value = true
  try {
    if (kind === 'tests') {
      const ielts = exam.value === 'IELTS'
      const title = await prompt({ title: ielts ? 'New IELTS test (Academic; change it on the test)' : 'New Multilevel test', label: 'Title', placeholder: ielts ? 'IELTS Academic Practice Test 2' : 'Multilevel Practice Test 2', confirmLabel: 'Create' })
      if (!title?.trim()) return
      const test = await libraryAPI.createTest({ title: title.trim(), module: ielts ? 'ACADEMIC' : 'MULTILEVEL' })
      return navigateTo(`/builder/tests/${test.id}`)
    }
    if (kind === 'listening' || kind === 'reading') {
      const part = await libraryAPI.createPart({ exam: exam.value, skill: kind.toUpperCase(), partNumber: 1, title: kind === 'reading' ? 'New passage' : 'New part' })
      return navigateTo(`/builder/parts/${part.id}`)
    }
    if (kind === 'writing') {
      // The essay: Task 2 in both exams (Multilevel numbers it 3).
      const task = await libraryAPI.createWritingTask({ exam: exam.value, taskNumber: exam.value === 'IELTS' ? 2 : 3, prompt: '<p>Write the question here.</p>' })
      return navigateTo(`/builder/writing/${task.id}`)
    }
    const part = await libraryAPI.createSpeakingPart({ exam: exam.value, partNumber: 1, questions: [] })
    return navigateTo(`/builder/speaking/${part.id}`)
  } catch (e) {
    toast.add({ title: 'Not created', description: errorMessage(e), color: 'error' })
  } finally {
    creating.value = false
  }
}

// ─── Importing tests (erp-lms/ielts-test files, from the IELTS addon or Antigravity) ───
const importInput = ref<HTMLInputElement>()
async function importFile(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])]
  if (!files.length) return
  let last: string | null = null
  let count = 0
  for (const file of files) {
    try {
      const res: any = await libraryAPI.importTest(JSON.parse(await file.text()))
      count++
      last = res.id
      // The list shows one exam: switch to the one the test is for, so it is there when you come back.
      setExam(examOfModule(res.module))
      toast.add({ title: `${file.name} imported`, description: 'It is a draft until you publish it.', color: 'success' })
    } catch (err) {
      toast.add({ title: `${file.name} not imported`, description: errorMessage(err), color: 'error' })
    }
  }
  if (importInput.value) importInput.value.value = ''
  if (count === 1 && last) await navigateTo(`/builder/tests/${last}`)
  else {
    tab.value = 'tests'
    await refresh()
  }
}

// ─── Speaking parts with their audio and sample answers, in and out as a file ───
const speakingImport = ref(false)
const speakingExport = computed(() => `/api/admin/speaking-parts/export?exam=${exam.value}`)
/** How much of a part's examiner audio and sample answers the test brings itself. */
function speakingExtras(s: SpeakingPart) {
  const longTurn = !answeredByQuestion(s.partNumber, s.exam)
  const turns = longTurn ? [s] : s.questions ?? []
  return { audio: turns.filter(t => t.audioRef).length, samples: turns.filter(t => t.sampleAnswer).length, of: turns.length }
}

const open = (row: any) => navigateTo(
  tab.value === 'tests'
    ? `/builder/tests/${row.id}`
    : tab.value === 'writing'
      ? `/builder/writing/${row.id}`
      : tab.value === 'speaking' ? `/builder/speaking/${row.id}` : `/builder/parts/${row.id}`)

const strip = (html?: string | null) => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
/** All four skills, each with something in it (as the server's full-test filter counts it). */
const isFull = (t: TestSummary) => new Set(t.sections.filter(x => (x.items ?? 0) > 0).map(x => x.skill)).size === 4
const statusItems = [{ label: 'Any status', value: 'ALL' }, { label: 'Draft', value: 'DRAFT' }, { label: 'Published', value: 'PUBLISHED' }, { label: 'Archived', value: 'ARCHIVED' }]
const createLabel = computed(() => ({ tests: exam.value === 'IELTS' ? 'New IELTS test' : 'New Multilevel test', listening: 'New Listening part', reading: 'New Reading passage', writing: 'New Writing task', speaking: 'New Speaking part' } as Record<string, string>)[tab.value])
</script>

<template>
  <AppPage
    title="Test builder"
    icon="i-lucide-hammer"
    wide
  >
    <template #actions>
      <template v-if="tab === 'tests'">
        <input
          ref="importInput"
          type="file"
          accept="application/json,.json"
          multiple
          class="hidden"
          @change="importFile"
        >
        <UButton
          label="Import"
          icon="i-lucide-file-down"
          color="neutral"
          variant="outline"
          class="max-sm:hidden"
          @click="importInput?.click()"
        />
      </template>
      <template v-if="tab === 'speaking'">
        <UButton
          label="Export"
          icon="i-lucide-file-up"
          color="neutral"
          variant="ghost"
          class="max-sm:hidden"
          :href="speakingExport"
          download
        />
        <UButton
          label="Import"
          icon="i-lucide-file-down"
          color="neutral"
          variant="outline"
          class="max-sm:hidden"
          data-testid="speaking-import"
          @click="speakingImport = true"
        />
      </template>
      <UButton
        :label="createLabel"
        icon="i-lucide-plus"
        :loading="creating"
        @click="() => { create(tab) }"
      />
    </template>
    <template #toolbar>
      <UDashboardToolbar>
        <div class="flex flex-wrap items-center gap-2 py-1 w-full">
          <USelect
            :model-value="exam"
            :items="[{ label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel', value: 'MULTILEVEL' }]"
            aria-label="Exam"
            class="w-36"
            @update:model-value="v => setExam(v as Exam)"
          />
          <UTabs
            v-model="tab"
            :items="TABS"
            :content="false"
            size="sm"
          />
          <div class="flex items-center gap-2 ml-auto">
            <template v-if="tab === 'tests'">
              <USelect
                v-model="completeness"
                :items="completenessItems"
                class="w-36"
                data-testid="full-filter"
              />
              <USelect
                v-model="testStatus"
                :items="statusItems"
                class="w-36"
              />
            </template>
            <USelect
              v-else
              v-model="used"
              :items="usedItems"
              class="w-40"
              data-testid="used-filter"
            />
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Search"
              class="w-52"
            />
          </div>
        </div>
      </UDashboardToolbar>
    </template>

    <UCard :ui="{ body: 'p-0 sm:p-0', header: 'px-4 py-2.5 sm:px-4' }">
      <!-- Tests: pick some, then one action for them all -->
      <template
        v-if="tab === 'tests' && pageTests.length"
        #header
      >
        <div
          class="flex flex-wrap items-center gap-2 min-h-8"
          data-testid="bulk-bar"
        >
          <UCheckbox
            :model-value="allPicked"
            :indeterminate="picked.length > 0 && !allPicked"
            :label="picked.length ? `${picked.length} selected` : 'Select all on this page'"
            @update:model-value="v => (picked = v ? [...pageTests] : [])"
          />
          <template v-if="picked.length">
            <UButton
              label="Publish"
              icon="i-lucide-send"
              size="sm"
              :loading="bulkBusy"
              data-testid="bulk-publish"
              @click="bulk('PUBLISH')"
            />
            <UButton
              label="To draft"
              icon="i-lucide-file-pen"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="bulkBusy"
              @click="bulk('DRAFT')"
            />
            <UButton
              label="Archive"
              icon="i-lucide-archive"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="bulkBusy"
              @click="bulk('ARCHIVE')"
            />
            <UDropdownMenu
              :items="[[
                { label: 'Make free', icon: 'i-lucide-gift', onSelect: () => bulk('FREE') },
                { label: 'Make Premium', icon: 'i-lucide-sparkles', onSelect: () => bulk('PREMIUM') }
              ]]"
            >
              <UButton
                label="Access"
                trailing-icon="i-lucide-chevron-down"
                size="sm"
                color="neutral"
                variant="outline"
                :loading="bulkBusy"
              />
            </UDropdownMenu>
            <UButton
              label="Delete"
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="soft"
              :loading="bulkBusy"
              @click="bulk('DELETE')"
            />
            <UButton
              label="Clear"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="picked = []"
            />
          </template>
        </div>
      </template>
      <ul class="divide-y divide-default">
        <li
          v-if="status === 'pending' && !data"
          class="p-4"
        >
          <USkeleton class="h-48" />
        </li>

        <template v-if="tab === 'tests'">
          <li
            v-for="t in (data?.items ?? []) as TestSummary[]"
            :key="t.id"
            class="px-4 py-3 flex items-center gap-3 hover:bg-elevated/50 cursor-pointer"
            :class="picked.includes(t.id) ? 'bg-primary/5' : ''"
            data-testid="test-row"
            @click="open(t)"
          >
            <UCheckbox
              :model-value="picked.includes(t.id)"
              :aria-label="`Select ${t.title}`"
              @click.stop
              @update:model-value="v => togglePick(t.id, !!v)"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate">
                {{ t.title }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ examLabel(t.exam, t.module) }} · {{ t.mode === 'MOCK' ? 'Mock' : 'Practice' }}
                <span v-if="t.category"> · {{ categoryLabel(t.category) }}</span>
                · {{ t.sections.map(s => SKILL_META[s.skill].label).join(', ') || 'no sections' }}
              </p>
            </div>
            <span class="text-xs text-muted tabular-nums max-sm:hidden">{{ t.attempts ?? 0 }} attempts</span>
            <UBadge
              v-if="isFull(t)"
              label="Full test"
              icon="i-lucide-layers"
              color="success"
              variant="subtle"
              class="max-sm:hidden"
            />
            <UBadge
              v-if="t.access === 'PREMIUM'"
              label="Premium"
              icon="i-lucide-sparkles"
              color="primary"
              variant="soft"
            />
            <UBadge
              :label="STATUS_META[t.status ?? 'DRAFT']!.label"
              :color="STATUS_META[t.status ?? 'DRAFT']!.color"
              variant="subtle"
            />
          </li>
        </template>

        <template v-else-if="tab === 'listening' || tab === 'reading'">
          <li
            v-for="p in (data?.items ?? []) as Part[]"
            :key="p.id"
            class="px-4 py-3 flex items-center gap-3 hover:bg-elevated/50 cursor-pointer"
            @click="open(p)"
          >
            <UBadge
              :label="`Part ${p.partNumber}`"
              color="neutral"
              variant="soft"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate">
                {{ p.title || 'Untitled' }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ p.questionCount ?? 0 }} questions<span v-if="p.from"> ({{ p.from }}–{{ p.to }})</span>
                <span v-if="p.types?.length"> · {{ p.types.map(questionTypeLabel).join(', ') }}</span>
              </p>
            </div>
            <span
              v-if="p.tests?.length"
              class="text-xs text-muted max-sm:hidden"
            >in {{ p.tests.length }} test{{ p.tests.length === 1 ? '' : 's' }}</span>
            <UBadge
              v-else
              label="Not in a test"
              color="warning"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="p.isActive === false"
              label="Inactive"
              color="neutral"
              variant="subtle"
            />
          </li>
        </template>

        <template v-else-if="tab === 'writing'">
          <li
            v-for="w in (data?.items ?? []) as WritingTask[]"
            :key="w.id"
            class="px-4 py-3 flex items-center gap-3 hover:bg-elevated/50 cursor-pointer"
            @click="open(w)"
          >
            <UBadge
              :label="writingTaskLabel(w.taskNumber, w.exam)"
              color="neutral"
              variant="soft"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate">
                {{ w.title || strip(w.prompt).slice(0, 90) || 'Untitled' }}
              </p>
              <p class="text-xs text-muted">
                At least {{ w.minWords ?? writingDefaults(w.taskNumber, w.exam).minWords }} words<span v-if="w.essays"> · {{ w.essays }} essays</span>
              </p>
            </div>
            <span
              v-if="w.inTests"
              class="text-xs text-muted max-sm:hidden"
            >in {{ w.inTests }} test{{ w.inTests === 1 ? '' : 's' }}</span>
            <UBadge
              v-else
              label="Not in a test"
              color="warning"
              variant="subtle"
              size="sm"
            />
          </li>
        </template>

        <template v-else>
          <li
            v-for="s in (data?.items ?? []) as SpeakingPart[]"
            :key="s.id"
            class="px-4 py-3 flex items-center gap-3 hover:bg-elevated/50 cursor-pointer"
            @click="open(s)"
          >
            <UBadge
              :label="speakingPartLabel(s.partNumber, s.exam)"
              color="neutral"
              variant="soft"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate">
                {{ s.title || strip(s.cueCard).slice(0, 90) || 'Untitled' }}
              </p>
              <p class="text-xs text-muted flex flex-wrap gap-x-3">
                <span>{{ s.questions?.length ?? 0 }} questions</span>
                <span
                  v-if="speakingExtras(s).audio"
                  :class="speakingExtras(s).audio === speakingExtras(s).of ? 'text-success' : ''"
                ><UIcon
                  name="i-lucide-volume-2"
                  class="size-3 align-[-1px]"
                /> audio {{ speakingExtras(s).audio }}/{{ speakingExtras(s).of }}</span>
                <span
                  v-if="speakingExtras(s).samples"
                  :class="speakingExtras(s).samples === speakingExtras(s).of ? 'text-success' : ''"
                ><UIcon
                  name="i-lucide-message-square-quote"
                  class="size-3 align-[-1px]"
                /> samples {{ speakingExtras(s).samples }}/{{ speakingExtras(s).of }}</span>
              </p>
            </div>
            <span
              v-if="s.inTests"
              class="text-xs text-muted max-sm:hidden"
            >in {{ s.inTests }} test{{ s.inTests === 1 ? '' : 's' }}</span>
            <UBadge
              v-else
              label="Not in a test"
              color="warning"
              variant="subtle"
              size="sm"
            />
          </li>
        </template>

        <li
          v-if="status !== 'pending' && !data?.items?.length"
          class="p-8"
        >
          <UEmpty
            icon="i-lucide-library"
            title="Nothing here yet"
            :description="`${createLabel} to start.`"
            variant="naked"
            :actions="[{ label: createLabel, icon: 'i-lucide-plus', onClick: () => { create(tab) } }]"
          />
        </li>
      </ul>
    </UCard>
    <div
      v-if="(data?.pages ?? 1) > 1"
      class="flex justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="data?.total ?? 0"
        :items-per-page="20"
      />
    </div>
    <BuilderSpeakingImport
      v-model:open="speakingImport"
      :exam="exam"
      @imported="refresh"
    />
  </AppPage>
</template>
