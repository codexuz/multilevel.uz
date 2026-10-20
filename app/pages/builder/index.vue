<script setup lang="ts">
import type { Part, SpeakingPart, TestSummary, WritingTask } from '~/types/ielts'
import { libraryAPI } from '~/services/ielts'

/**
 * The library (the IELTS addon's builder). Parts, writing tasks and speaking parts are written once
 * and reused; a test is a paper put together from them, section by section.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Test builder', robots: 'noindex' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { prompt } = useDialogs()

const TABS = [
  { label: 'Tests', value: 'tests', icon: 'i-lucide-files' },
  { label: 'Listening', value: 'listening', icon: SKILL_META.LISTENING.icon },
  { label: 'Reading', value: 'reading', icon: SKILL_META.READING.icon },
  { label: 'Writing', value: 'writing', icon: SKILL_META.WRITING.icon },
  { label: 'Speaking', value: 'speaking', icon: SKILL_META.SPEAKING.icon }
]
// The tab is kept in the address, written only when it is chosen here: following the query back
// would pull a click on a row back to this page as the address changes.
const tabOf = (v: unknown) => (TABS.some(t => t.value === v) ? String(v) : 'tests')
const tab = ref(tabOf(route.query.tab))
watch(tab, v => router.replace({ query: { ...route.query, tab: v, page: undefined } }))
watch(() => route.query.tab, (v) => {
  if (route.path === '/builder') tab.value = tabOf(v)
})
const page = ref(1)
const search = ref('')
const q = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (q.value = v), 300)
})
// 'ALL' rather than empty: a select cannot hold an empty value.
const testStatus = ref('ALL')
watch([tab, q, testStatus], () => (page.value = 1))

const { data, status, refresh } = useAsyncData(
  'builder:list',
  (): Promise<any> => {
    const p = { page: page.value, limit: 20, search: q.value || undefined }
    if (tab.value === 'tests') return libraryAPI.tests({ ...p, status: testStatus.value === 'ALL' ? undefined : testStatus.value })
    if (tab.value === 'listening') return libraryAPI.parts({ ...p, skill: 'LISTENING' })
    if (tab.value === 'reading') return libraryAPI.parts({ ...p, skill: 'READING' })
    if (tab.value === 'writing') return libraryAPI.writingTasks(p)
    return libraryAPI.speakingParts(p)
  },
  { watch: [tab, page, q, testStatus], lazy: true }
)

// ─── Creating ──────────────────────────────────────────────────────────────
const creating = ref(false)
async function create(kind: string) {
  creating.value = true
  try {
    if (kind === 'tests') {
      const title = await prompt({ title: 'New test', label: 'Title', placeholder: 'Multilevel Practice Test 2', confirmLabel: 'Create' })
      if (!title?.trim()) return
      const test = await libraryAPI.createTest({ title: title.trim() })
      return navigateTo(`/builder/tests/${test.id}`)
    }
    if (kind === 'listening' || kind === 'reading') {
      const part = await libraryAPI.createPart({ skill: kind.toUpperCase(), partNumber: 1, title: kind === 'reading' ? 'New passage' : 'New part' })
      return navigateTo(`/builder/parts/${part.id}`)
    }
    if (kind === 'writing') {
      const task = await libraryAPI.createWritingTask({ taskNumber: 3, prompt: '<p>Write the question here.</p>' })
      return navigateTo(`/builder/writing/${task.id}`)
    }
    const part = await libraryAPI.createSpeakingPart({ partNumber: 1, questions: [] })
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

const open = (row: any) => navigateTo(
  tab.value === 'tests'
    ? `/builder/tests/${row.id}`
    : tab.value === 'writing'
      ? `/builder/writing/${row.id}`
      : tab.value === 'speaking' ? `/builder/speaking/${row.id}` : `/builder/parts/${row.id}`)

const strip = (html?: string | null) => (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const statusItems = [{ label: 'Any status', value: 'ALL' }, { label: 'Draft', value: 'DRAFT' }, { label: 'Published', value: 'PUBLISHED' }, { label: 'Archived', value: 'ARCHIVED' }]
const createLabel = computed(() => ({ tests: 'New test', listening: 'New Listening part', reading: 'New Reading passage', writing: 'New Writing task', speaking: 'New Speaking part' } as Record<string, string>)[tab.value])
</script>

<template>
  <AppPage
    title="Test builder"
    icon="i-lucide-hammer"
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
          <UTabs
            v-model="tab"
            :items="TABS"
            :content="false"
            size="sm"
          />
          <div class="flex items-center gap-2 ml-auto">
            <USelect
              v-if="tab === 'tests'"
              v-model="testStatus"
              :items="statusItems"
              class="w-36"
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

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
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
            @click="open(t)"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate">
                {{ t.title }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ t.mode === 'MOCK' ? 'Mock' : 'Practice' }}
                <span v-if="t.category"> · {{ categoryLabel(t.category) }}</span>
                · {{ t.sections.map(s => SKILL_META[s.skill].label).join(', ') || 'no sections' }}
              </p>
            </div>
            <span class="text-xs text-muted tabular-nums max-sm:hidden">{{ t.attempts ?? 0 }} attempts</span>
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
              :label="writingTaskLabel(w.taskNumber)"
              color="neutral"
              variant="soft"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate">
                {{ w.title || strip(w.prompt).slice(0, 90) || 'Untitled' }}
              </p>
              <p class="text-xs text-muted">
                At least {{ w.minWords ?? writingDefaults(w.taskNumber).minWords }} words<span v-if="w.essays"> · {{ w.essays }} essays</span>
              </p>
            </div>
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
              :label="speakingPartLabel(s.partNumber)"
              color="neutral"
              variant="soft"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted truncate">
                {{ s.title || strip(s.cueCard).slice(0, 90) || 'Untitled' }}
              </p>
              <p class="text-xs text-muted">
                {{ s.questions?.length ?? 0 }} questions
              </p>
            </div>
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
  </AppPage>
</template>
