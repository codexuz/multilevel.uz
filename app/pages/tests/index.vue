<script setup lang="ts">
import type { Paged } from '~/types/ielts'

definePageMeta({ guestLayout: true })

/**
 * The open catalogue, rendered on the server so every title and description is in the page Google
 * reads. Full tests, or parts to practise on their own, filtered by words, skill, part, question
 * type, and whether a test has all four skills. The filters live in the address, so a filtered
 * list can be shared and comes back on reload.
 */
const route = useRoute()
const router = useRouter()
const ALL = 'ALL'
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)

const view = ref<'tests' | 'parts'>(route.query.view === 'parts' ? 'parts' : 'tests')
const search = ref(str(route.query.q))
const q = ref(search.value)
const skill = ref(str(route.query.skill, ALL))
const part = ref(str(route.query.part, ALL))
const type = ref(str(route.query.type, ALL))
const full = ref(route.query.full === '1')
const page = ref(Number(route.query.page) || 1)

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (q.value = v.trim()), 300)
})
// Part numbers: a skill's own (Speaking's 1.1, 1.2, 2, 3), or 1–6 across every skill.
const partNumbers = computed(() => (skill.value === ALL ? [1, 2, 3, 4, 5, 6] : PART_NUMBERS[skill.value] ?? []))
// Question types belong to Listening and Reading.
watch(skill, (s) => {
  if (part.value !== ALL && !partNumbers.value.includes(Number(part.value))) part.value = ALL
  if (s === 'WRITING' || s === 'SPEAKING') type.value = ALL
})
// The address can also change from outside (the Tests link, back and forward): follow it.
watch(() => route.query, (rq) => {
  const nextView = rq.view === 'parts' ? 'parts' : 'tests'
  if (view.value !== nextView) view.value = nextView
  if (q.value !== str(rq.q)) search.value = q.value = str(rq.q)
  if (skill.value !== str(rq.skill, ALL)) skill.value = str(rq.skill, ALL)
  if (part.value !== str(rq.part, ALL)) part.value = str(rq.part, ALL)
  if (type.value !== str(rq.type, ALL)) type.value = str(rq.type, ALL)
  if (full.value !== (rq.full === '1')) full.value = rq.full === '1'
})
watch([view, q, skill, part, type, full], () => (page.value = 1))
watch([view, q, skill, part, type, full, page], () => router.replace({
  query: {
    ...(view.value === 'parts' ? { view: 'parts' } : {}),
    ...(q.value ? { q: q.value } : {}),
    ...(skill.value !== ALL ? { skill: skill.value } : {}),
    ...(view.value === 'parts' && part.value !== ALL ? { part: part.value } : {}),
    ...(type.value !== ALL ? { type: type.value } : {}),
    ...(view.value === 'tests' && full.value ? { full: '1' } : {}),
    ...(page.value > 1 ? { page: String(page.value) } : {})
  }
}))

const query = computed(() => ({
  search: q.value || undefined,
  skill: skill.value !== ALL ? skill.value : undefined,
  part: view.value === 'parts' && part.value !== ALL ? part.value : undefined,
  type: type.value !== ALL ? type.value : undefined,
  full: view.value === 'tests' && full.value ? '1' : undefined,
  page: page.value,
  limit: view.value === 'parts' ? 24 : 12
}))
const { data, status } = await useFetch<Paged<any> & { fullTests?: number }>(() => (view.value === 'parts' ? '/api/practice/parts' : '/api/tests'), { query })

const views = [{ label: 'Full tests', value: 'tests', icon: 'i-lucide-files' }, { label: 'By part', value: 'parts', icon: 'i-lucide-puzzle' }]
const skillItems = [{ label: 'All skills', value: ALL }, ...(['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const).map(s => ({ label: SKILL_META[s].label, value: s, icon: SKILL_META[s].icon }))]
const partItems = computed(() => [{ label: 'Any part', value: ALL }, ...partNumbers.value.map(n => ({ label: skill.value === ALL ? `Part ${n}` : partName(skill.value, n), value: String(n) }))])
/** How many tests (with the other filters) have all four skills: shown on the switch. */
const fullTests = ref<number | null>(null)
watch(data, d => d && view.value === 'tests' && d.fullTests != null && (fullTests.value = d.fullTests), { immediate: true })
const typeItems = [{ label: 'All question types', value: ALL }, ...QUESTION_TYPES.map(t => ({ label: t.label, value: t.value, icon: t.icon }))]
const typesApply = computed(() => skill.value !== 'WRITING' && skill.value !== 'SPEAKING')
const filtered = computed(() => !!q.value || skill.value !== ALL || type.value !== ALL || (view.value === 'parts' && part.value !== ALL) || (view.value === 'tests' && full.value))
function clear() {
  search.value = ''
  q.value = ''
  skill.value = ALL
  part.value = ALL
  type.value = ALL
  full.value = false
}
const countText = computed(() => {
  const n = data.value?.total ?? 0
  return view.value === 'parts' ? `${n} ${n === 1 ? 'part' : 'parts'}` : `${n} ${n === 1 ? 'test' : 'tests'}`
})

useSeoMeta({
  title: 'Free Multilevel practice tests',
  description: 'Free Multilevel (CEFR) English practice tests with instant checking: full tests or single parts of Listening, Reading, Writing and Speaking in the real exam format.'
})
</script>

<template>
  <AppPage
    title="Tests"
    icon="i-lucide-clipboard-list"
  >
    <div class="flex flex-col gap-5">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          Multilevel <span class="text-accent">practice tests</span>
        </h1>
        <p class="text-muted mt-1">
          Sit a full test, or practise one part at a time. Listening and Reading are checked the moment you finish.
        </p>
      </div>

      <LiveMockBanner />

      <UTabs
        v-model="view"
        :items="views"
        :content="false"
        class="w-full sm:w-80"
      />

      <div class="flex flex-col gap-3">
        <div class="grid gap-2 grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="view === 'parts' ? 'Search parts' : 'Search tests'"
            aria-label="Search"
            class="col-span-2 lg:w-72"
          />
          <USelect
            v-model="skill"
            :items="skillItems"
            aria-label="Skill"
            class="lg:w-44"
            :class="view === 'tests' ? 'col-span-2 lg:col-span-1' : ''"
          />
          <USelect
            v-if="view === 'parts'"
            v-model="part"
            :items="partItems"
            aria-label="Part"
            class="lg:w-36"
          />
          <USelectMenu
            v-if="typesApply"
            v-model="type"
            :items="typeItems"
            value-key="value"
            :search-input="{ placeholder: 'Find a question type' }"
            aria-label="Question type"
            class="col-span-2 lg:w-64"
          />
          <USwitch
            v-if="view === 'tests'"
            v-model="full"
            label="Full tests only"
            :description="`All four skills${fullTests != null ? ` · ${fullTests} ${fullTests === 1 ? 'test' : 'tests'}` : ''}`"
            class="col-span-2 sm:col-span-1 lg:ms-2"
          />
        </div>
        <div class="flex items-center justify-between gap-3 min-h-8">
          <p class="text-sm text-muted">
            {{ status === 'pending' && !data ? 'Loading…' : countText }}
          </p>
          <UButton
            v-if="filtered"
            label="Clear filters"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clear"
          />
        </div>
      </div>

      <div
        v-if="status === 'pending' && !data?.items?.length"
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <USkeleton
          v-for="i in 6"
          :key="i"
          :class="view === 'parts' ? 'h-32' : 'h-44'"
          class="rounded-xl"
        />
      </div>
      <div
        v-else-if="!data?.items?.length"
        class="flex flex-col items-center text-center gap-3 rounded-xl ring ring-default px-6 py-12"
      >
        <img
          src="/illustrations/target.svg"
          alt=""
          class="size-14"
        >
        <p class="font-semibold text-highlighted">
          {{ view === 'tests' && full ? 'No full tests yet' : filtered ? `No ${view === 'parts' ? 'parts' : 'tests'} match these filters` : 'No tests yet' }}
        </p>
        <p class="text-sm text-muted max-w-xs">
          {{ view === 'tests' && full ? 'A full test has all four skills: Listening, Reading, Writing and Speaking. Turn off "Full tests only" to see every test.' : filtered ? 'Try fewer filters or other words.' : 'New tests are published here.' }}
        </p>
        <UButton
          v-if="filtered"
          label="Clear filters"
          color="neutral"
          variant="outline"
          @click="clear"
        />
      </div>
      <div
        v-else-if="view === 'parts'"
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3"
      >
        <PartCard
          v-for="p in data.items"
          :key="p.id"
          :part="p"
        />
      </div>
      <div
        v-else
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <TestCard
          v-for="t in data.items"
          :key="t.id"
          :test="t"
        />
      </div>

      <div
        v-if="(data?.pages ?? 1) > 1"
        class="flex justify-center"
      >
        <UPagination
          v-model:page="page"
          :total="data!.total"
          :items-per-page="data!.limit"
        />
      </div>
    </div>
  </AppPage>
</template>
