<script setup lang="ts">
import type { Paged } from '~/types/ielts'
import type { Pack } from '~/utils/billing'

definePageMeta({ guestLayout: true })

/**
 * The open catalogue, rendered on the server so every title and description is in the page Google
 * reads. One exam: a signed-in user's own (from onboarding), or the one a guest picked. Three
 * segments: full tests, parts to practise on their own, and test packs. Tests and parts are filtered
 * by words, skill, part, question type, and whether a test has all four skills (and, for IELTS,
 * Academic or General Training); full tests also by free or Premium and by category, and run in
 * the order of their numbers (Test 1 to Test 21). The filters live in the address, so a filtered list can be shared
 * and comes back on reload.
 */
const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const ALL = 'ALL'
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
// A signed-in user sees their own exam only; a guest's ?exam= (from the home page, or a shared link) picks one.
// An admin looks at either exam's catalogue (?exam=, or the switch here) without changing their own.
const { loggedIn, isAdmin } = useMe()
const { exam: ownExam, setExam } = useExam()
const adminExam = ref<Exam | null>(isAdmin.value && isExam(route.query.exam) ? route.query.exam : null)
const exam = computed<Exam>(() => adminExam.value ?? ownExam.value)
if (!loggedIn.value && isExam(route.query.exam) && route.query.exam !== exam.value) await setExam(route.query.exam)
const examItems = [{ label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel', value: 'MULTILEVEL' }]
const ieltsModule = ref(str(route.query.module, ALL))

type View = 'tests' | 'parts' | 'packs'
const viewOf = (v: unknown): View => (v === 'parts' || v === 'packs' ? v : 'tests')
const view = ref<View>(viewOf(route.query.view))
const search = ref(str(route.query.q))
const q = ref(search.value)
const skill = ref(str(route.query.skill, ALL))
const part = ref(str(route.query.part, ALL))
const type = ref(str(route.query.type, ALL))
const full = ref(route.query.full === '1')
const access = ref(str(route.query.access, ALL))
const category = ref(str(route.query.category, ALL))
const page = ref(Number(route.query.page) || 1)

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(timer)
  timer = setTimeout(() => (q.value = v.trim()), 300)
})
// Part numbers: a skill's own in this exam (Multilevel Speaking's 1.1, 1.2, 2, 3), or every one across the skills.
const partNumbers = computed(() => (skill.value === ALL
  ? [...new Set(['LISTENING', 'READING', 'WRITING', 'SPEAKING'].flatMap(s => partNumbersOf(exam.value, s)))].sort((a, b) => a - b)
  : partNumbersOf(exam.value, skill.value)))
watch(exam, () => {
  if (exam.value !== 'IELTS') ieltsModule.value = ALL
  if (part.value !== ALL && !partNumbers.value.includes(Number(part.value))) part.value = ALL
})
// Question types belong to Listening and Reading.
watch(skill, (s) => {
  if (part.value !== ALL && !partNumbers.value.includes(Number(part.value))) part.value = ALL
  if (s === 'WRITING' || s === 'SPEAKING') type.value = ALL
})
// The address can also change from outside (the Tests link, back and forward): follow it.
watch(() => route.query, (rq) => {
  const nextView = viewOf(rq.view)
  if (view.value !== nextView) view.value = nextView
  if (q.value !== str(rq.q)) search.value = q.value = str(rq.q)
  if (skill.value !== str(rq.skill, ALL)) skill.value = str(rq.skill, ALL)
  if (part.value !== str(rq.part, ALL)) part.value = str(rq.part, ALL)
  if (type.value !== str(rq.type, ALL)) type.value = str(rq.type, ALL)
  if (full.value !== (rq.full === '1')) full.value = rq.full === '1'
  if (access.value !== str(rq.access, ALL)) access.value = str(rq.access, ALL)
  if (category.value !== str(rq.category, ALL)) category.value = str(rq.category, ALL)
  if (ieltsModule.value !== str(rq.module, ALL)) ieltsModule.value = str(rq.module, ALL)
  if (!loggedIn.value && isExam(rq.exam) && rq.exam !== exam.value) setExam(rq.exam)
  if (isAdmin.value && isExam(rq.exam) && rq.exam !== exam.value) adminExam.value = rq.exam
})
watch([view, q, skill, part, type, full, access, category, exam, ieltsModule], () => (page.value = 1))
// Another exam has other categories.
watch(exam, () => (category.value = ALL))
watch([view, q, skill, part, type, full, access, category, page, exam, ieltsModule], () => router.replace({
  query: {
    exam: exam.value,
    ...(exam.value === 'IELTS' && ieltsModule.value !== ALL ? { module: ieltsModule.value } : {}),
    ...(view.value !== 'tests' ? { view: view.value } : {}),
    ...(q.value ? { q: q.value } : {}),
    ...(skill.value !== ALL ? { skill: skill.value } : {}),
    ...(view.value === 'parts' && part.value !== ALL ? { part: part.value } : {}),
    ...(type.value !== ALL ? { type: type.value } : {}),
    ...(view.value === 'tests' && full.value ? { full: '1' } : {}),
    ...(view.value === 'tests' && access.value !== ALL ? { access: access.value } : {}),
    ...(view.value === 'tests' && category.value !== ALL ? { category: category.value } : {}),
    ...(page.value > 1 ? { page: String(page.value) } : {})
  }
}))

const query = computed(() => ({
  exam: exam.value,
  module: exam.value === 'IELTS' && ieltsModule.value !== ALL ? ieltsModule.value : undefined,
  search: q.value || undefined,
  skill: skill.value !== ALL ? skill.value : undefined,
  part: view.value === 'parts' && part.value !== ALL ? part.value : undefined,
  type: type.value !== ALL ? type.value : undefined,
  full: view.value === 'tests' && full.value ? '1' : undefined,
  access: view.value === 'tests' && access.value !== ALL ? access.value : undefined,
  category: view.value === 'tests' && category.value !== ALL ? category.value : undefined,
  page: page.value,
  limit: view.value === 'parts' ? 24 : 12
}))
const { data, status } = await useFetch<Paged<any> & { fullTests?: number, categories?: string[] }>(() => (view.value === 'parts' ? '/api/practice/parts' : '/api/tests'), { query })
const { data: packs } = await useFetch<Pack[]>('/api/packs', { query: computed(() => ({ exam: exam.value })), default: () => [] })
const moduleItems = computed(() => [
  { label: t('exam.allModules'), value: ALL },
  { label: t('exam.academic'), value: 'ACADEMIC' },
  { label: t('exam.general'), value: 'GENERAL_TRAINING' }
])
const views = computed(() => [
  { label: t('tests.fullTests'), value: 'tests', icon: 'i-lucide-files' },
  { label: t('tests.byPart'), value: 'parts', icon: 'i-lucide-puzzle' },
  { label: t('packs.title'), value: 'packs', icon: 'i-lucide-package' }
])
const skillItems = computed(() => [{ label: t('tests.allSkills'), value: ALL }, ...(['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const).map(s => ({ label: skillLabel(s), value: s, icon: SKILL_META[s].icon }))])
const partItems = computed(() => [{ label: t('tests.anyPart'), value: ALL }, ...partNumbers.value.map(n => ({ label: skill.value === ALL ? t('part.part', { n }) : partName(skill.value, n, exam.value), value: String(n) }))])
const accessItems = computed(() => [
  { label: t('tests.allTests'), value: ALL },
  { label: t('tests.freeTests'), value: 'FREE', icon: 'i-lucide-gift' },
  { label: t('tests.premiumTests'), value: 'PREMIUM', icon: 'i-lucide-sparkles' }
])
/** The categories this exam's tests come in (kept from the last answer, so the list holds while one is picked). */
const categories = ref<string[]>([])
watch(data, d => d?.categories && (categories.value = d.categories), { immediate: true })
const categoryItems = computed(() => [{ label: t('tests.allCategories'), value: ALL }, ...categories.value.map(c => ({ label: categoryLabel(c), value: c }))])
/** How many tests (with the other filters) have all four skills: shown on the switch. */
const fullTests = ref<number | null>(null)
watch(data, d => d && view.value === 'tests' && d.fullTests != null && (fullTests.value = d.fullTests), { immediate: true })
const typeItems = computed(() => [{ label: t('tests.allTypes'), value: ALL }, ...QUESTION_TYPES.map(q => ({ label: questionTypeLabel(q.value), value: q.value, icon: q.icon }))])
const typesApply = computed(() => skill.value !== 'WRITING' && skill.value !== 'SPEAKING')
const filtered = computed(() => !!q.value || skill.value !== ALL || type.value !== ALL || ieltsModule.value !== ALL || (view.value === 'parts' && part.value !== ALL) || (view.value === 'tests' && (full.value || access.value !== ALL || category.value !== ALL)))
function clear() {
  ieltsModule.value = ALL
  search.value = ''
  q.value = ''
  skill.value = ALL
  part.value = ALL
  type.value = ALL
  full.value = false
  access.value = ALL
  category.value = ALL
}
const countText = computed(() => {
  const n = data.value?.total ?? 0
  return view.value === 'parts' ? t('tests.countParts', { n }, n) : t('tests.countTests', { n }, n)
})

useSeoMeta({
  title: () => (exam.value === 'IELTS' ? t('tests.seoTitleIelts') : t('tests.seoTitle')),
  description: () => (exam.value === 'IELTS' ? t('tests.seoDescriptionIelts') : t('tests.seoDescription'))
})
</script>

<template>
  <AppPage
    :title="t('nav.tests')"
    icon="i-lucide-clipboard-list"
  >
    <div class="flex flex-col gap-5">
      <div>
        <i18n-t
          :keypath="exam === 'IELTS' ? 'tests.titleIelts' : 'tests.title'"
          tag="h1"
          scope="global"
          class="text-2xl sm:text-3xl font-bold text-highlighted"
        >
          <template #accent>
            <span class="text-accent">{{ t('tests.titleAccent') }}</span>
          </template>
        </i18n-t>
        <p class="text-muted mt-1">
          {{ exam === 'IELTS' ? t('tests.introIelts') : t('tests.intro') }}
        </p>
      </div>

      <ExamSwitch v-if="!loggedIn" />

      <LiveMockBanner />

      <UTabs
        v-model="view"
        :items="views"
        :content="false"
        class="w-full sm:w-[28rem]"
      />

      <!-- Test packs: several tests bought once, each the buyer's for good -->
      <template v-if="view === 'packs'">
        <p class="text-sm text-muted -mt-2">
          {{ t('packs.intro') }}
        </p>
        <div
          v-if="packs.length"
          class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          <PackCard
            v-for="p in packs"
            :key="p.id"
            :pack="p"
          />
        </div>
        <div
          v-else
          class="flex flex-col items-center text-center gap-3 rounded-xl ring ring-default px-6 py-12"
        >
          <UIcon
            name="i-lucide-package-open"
            class="size-12 text-dimmed"
          />
          <p class="font-semibold text-highlighted">
            {{ t('packs.none', { exam: examLabel(exam) }) }}
          </p>
          <p class="text-sm text-muted max-w-sm">
            {{ t('packs.noneText') }}
          </p>
          <UButton
            to="/pricing"
            label="Premium"
            icon="i-lucide-sparkles"
            color="neutral"
            variant="outline"
          />
        </div>
      </template>

      <div
        v-else
        class="flex flex-col gap-3"
      >
        <div class="grid gap-2 grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="view === 'parts' ? t('tests.searchParts') : t('tests.searchTests')"
            :aria-label="t('tests.search')"
            class="col-span-2 lg:w-72"
          />
          <USelect
            v-if="isAdmin"
            :model-value="exam"
            :items="examItems"
            :aria-label="t('exam.exam')"
            class="lg:w-36"
            data-testid="catalogue-exam"
            @update:model-value="v => (adminExam = v as Exam)"
          />
          <USelect
            v-if="exam === 'IELTS'"
            v-model="ieltsModule"
            :items="moduleItems"
            :aria-label="t('exam.module')"
            class="col-span-2 lg:col-span-1 lg:w-52"
          />
          <USelect
            v-model="skill"
            :items="skillItems"
            :aria-label="t('tests.skill')"
            class="lg:w-44"
            :class="view === 'tests' ? 'col-span-2 lg:col-span-1' : ''"
          />
          <USelect
            v-if="view === 'parts'"
            v-model="part"
            :items="partItems"
            :aria-label="t('part.partWord')"
            class="lg:w-36"
          />
          <USelectMenu
            v-if="typesApply"
            v-model="type"
            :items="typeItems"
            value-key="value"
            :search-input="{ placeholder: t('tests.findType') }"
            :aria-label="t('tests.type')"
            class="col-span-2 lg:w-64"
          />
          <USelect
            v-if="view === 'tests'"
            v-model="access"
            :items="accessItems"
            :aria-label="t('tests.access')"
            class="lg:w-44"
            data-testid="filter-access"
          />
          <USelect
            v-if="view === 'tests' && categories.length > 1"
            v-model="category"
            :items="categoryItems"
            :aria-label="t('tests.category')"
            class="lg:w-48"
            data-testid="filter-category"
          />
          <USwitch
            v-if="view === 'tests'"
            v-model="full"
            :label="t('tests.fullOnly')"
            :description="`${t('tests.allFour')}${fullTests != null ? ` · ${t('tests.countTests', { n: fullTests }, fullTests)}` : ''}`"
            class="col-span-2 sm:col-span-1 lg:ms-2"
          />
        </div>
        <div class="flex items-center justify-between gap-3 min-h-8">
          <p class="text-sm text-muted">
            {{ status === 'pending' && !data ? t('common.loading') : countText }}
          </p>
          <UButton
            v-if="filtered"
            :label="t('tests.clear')"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clear"
          />
        </div>
      </div>

      <template v-if="view === 'packs'" />
      <div
        v-else-if="status === 'pending' && !data?.items?.length"
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
          {{ view === 'tests' && full ? t('tests.noFull') : filtered ? (view === 'parts' ? t('tests.noPartsMatch') : t('tests.noTestsMatch')) : t('tests.none') }}
        </p>
        <p class="text-sm text-muted max-w-xs">
          {{ view === 'tests' && full ? t('tests.noFullText') : filtered ? t('tests.fewerFilters') : t('tests.noneText') }}
        </p>
        <UButton
          v-if="filtered"
          :label="t('tests.clear')"
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
          v-for="test in data.items"
          :key="test.id"
          :test="test"
        />
      </div>

      <div
        v-if="view !== 'packs' && (data?.pages ?? 1) > 1"
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
