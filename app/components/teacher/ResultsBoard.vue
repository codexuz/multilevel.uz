<script setup lang="ts">
/**
 * Test results and course quiz answers of a teacher's students: of one class (its page, groupId) or
 * of every class with a class picker (the Results page, ?class=). Averages per skill on top; narrow
 * the list by skill, student or a search; a page at a time.
 */
const props = defineProps<{ groupId?: string }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

interface ExamRow { id: string, userId: string, studentName: string, avatarUrl: string | null, classes: string[], testTitle: string, skill: string, exam: string, score: number | null, band: number | null, cefrLevel: string | null, status: string, submittedAt: string, to: string }
interface QuizRow { id: string, userId: string, studentName: string, avatarUrl: string | null, classes: string[], courseTitle: string, lessonTitle: string, exerciseTitle: string, score: number, earnedPoints: number, totalPoints: number, passed: boolean, reviewStatus: string | null, submittedAt: string }

// On the Results page the class is in the address, so a class's "All results" link opens it.
const picked = computed<string>({
  get: () => props.groupId ?? (typeof route.query.class === 'string' ? route.query.class : 'all'),
  set: v => router.replace({ query: { ...route.query, class: v === 'all' ? undefined : v } })
})
const { data, status, refresh } = await useFetch<{ groups: { id: string, name: string }[], examResults: ExamRow[], exerciseResults: QuizRow[] }>('/api/teacher/results', {
  query: { groupId: computed(() => (picked.value === 'all' ? undefined : picked.value)) },
  default: () => ({ groups: [], examResults: [], exerciseResults: [] })
})
const oneClass = computed(() => picked.value !== 'all')

const tab = ref<'exams' | 'quizzes'>('exams')
const skill = ref('all')
const student = ref('all')
const search = ref('')
const page = ref(1)
const PAGE = 25
watch([tab, skill, student, search, picked], () => (page.value = 1))

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const
const classItems = computed(() => [{ label: t('res.allClasses'), value: 'all' }, ...data.value.groups.map(g => ({ label: g.name, value: g.id }))])
const skillItems = computed(() => [{ label: t('res.allSkills'), value: 'all' }, ...SKILLS.map(s => ({ label: skillLabel(s), value: s }))])
const studentItems = computed(() => {
  const seen = new Map<string, string>()
  for (const r of [...data.value.examResults, ...data.value.exerciseResults]) seen.set(r.userId, r.studentName)
  return [{ label: t('res.allStudents'), value: 'all' }, ...[...seen].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ label, value }))]
})

const q = computed(() => search.value.trim().toLowerCase())
// Written responses to look at: the AI marked them, or could not.
const toReviewOnly = ref(false)
const toReview = computed(() => data.value.exerciseResults.filter(r => r.reviewStatus === 'AI' || r.reviewStatus === 'PENDING').length)
const reviewing = ref<string | null>(null)
const reviewOpen = ref(false)
function review(id: string) {
  reviewing.value = id
  reviewOpen.value = true
}
const exams = computed(() => data.value.examResults.filter(r => (skill.value === 'all' || r.skill === skill.value)
  && (student.value === 'all' || r.userId === student.value)
  && (!q.value || r.studentName.toLowerCase().includes(q.value) || r.testTitle.toLowerCase().includes(q.value))))
const quizzes = computed(() => data.value.exerciseResults.filter(r => (student.value === 'all' || r.userId === student.value)
  && (!toReviewOnly.value || r.reviewStatus === 'AI' || r.reviewStatus === 'PENDING')
  && (!q.value || r.studentName.toLowerCase().includes(q.value) || r.courseTitle.toLowerCase().includes(q.value) || r.exerciseTitle.toLowerCase().includes(q.value))))
const rows = computed(() => (tab.value === 'exams' ? exams.value : quizzes.value))
function pageOf<T>(list: T[]) {
  return list.slice((page.value - 1) * PAGE, page.value * PAGE)
}

/** Per skill, over the graded results shown (student filter applies): IELTS band or Multilevel score of 75. */
const averages = computed(() => SKILLS.map((s) => {
  const list = data.value.examResults.filter(r => r.skill === s && (student.value === 'all' || r.userId === student.value))
  const bands = list.filter(r => r.exam === 'IELTS').map(r => r.band).filter((b): b is number => b != null)
  const scores = list.filter(r => r.exam !== 'IELTS').map(r => r.score).filter((x): x is number => x != null)
  const ielts = bands.length > scores.length
  const vals = ielts ? bands : scores
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  return { skill: s, n: list.length, value: avg == null ? '—' : ielts ? avg.toFixed(1) : `${Math.round(avg)}/75`, pct: avg == null ? 0 : ielts ? avg / 9 * 100 : avg / 75 * 100 }
}))
const scoreText = (r: ExamRow) => (r.exam === 'IELTS' && r.band != null ? t('tp.band', { band: r.band.toFixed(1) }) : r.score != null ? `${r.score}/75` : '—')
const day = (d: string) => localeDate(d, intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <div
    class="flex flex-col gap-4"
    data-testid="results-board"
  >
    <div
      v-if="!groupId"
      class="flex flex-wrap items-center gap-2"
    >
      <USelect
        v-model="picked"
        :items="classItems"
        icon="i-lucide-users"
        class="w-full sm:w-64"
        data-testid="results-class"
      />
      <UButton
        v-if="oneClass"
        :to="`/classes/${picked}`"
        :label="t('res.openClass')"
        trailing-icon="i-lucide-arrow-right"
        color="neutral"
        variant="ghost"
        size="sm"
      />
    </div>

    <!-- Averages per skill -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="a in averages"
        :key="a.skill"
        class="rounded-[var(--card-radius)] ring-2 ring-default bg-default p-4"
      >
        <p class="text-xs font-extrabold uppercase tracking-wide text-muted">
          {{ skillLabel(a.skill) }}
        </p>
        <p class="text-2xl font-extrabold text-highlighted tabular-nums mt-1">
          {{ a.value }}
        </p>
        <div class="h-2 rounded-full bg-accented/70 overflow-hidden mt-2">
          <div
            class="h-full rounded-full bg-primary"
            :style="{ width: `${Math.round(a.pct)}%` }"
          />
        </div>
        <p class="text-xs text-muted mt-1.5">
          {{ t('res.attempts', { n: a.n }, a.n) }}
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UTabs
        v-model="tab"
        :items="[
          { label: t('tp.examTab', { n: exams.length }), value: 'exams', icon: 'i-lucide-clipboard-check' },
          { label: t('tp.quizTab', { n: quizzes.length }), value: 'quizzes', icon: 'i-lucide-book-open-check' }
        ]"
        :content="false"
        size="sm"
      />
      <div class="flex flex-wrap gap-2 sm:ms-auto w-full sm:w-auto">
        <USelect
          v-if="tab === 'exams'"
          v-model="skill"
          :items="skillItems"
          class="w-36"
        />
        <UButton
          v-if="tab === 'quizzes' && toReview"
          :label="t('res.toReview', { n: toReview })"
          icon="i-lucide-pen-line"
          size="sm"
          :color="toReviewOnly ? 'primary' : 'neutral'"
          :variant="toReviewOnly ? 'solid' : 'outline'"
          data-testid="filter-review"
          @click="toReviewOnly = !toReviewOnly"
        />
        <USelect
          v-model="student"
          :items="studentItems"
          class="w-44"
          data-testid="results-student"
        />
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('tp.filterResults')"
          class="w-full sm:w-56"
        />
      </div>
    </div>

    <USkeleton
      v-if="status === 'pending' && !data.examResults.length && !data.exerciseResults.length"
      class="h-48 rounded-[var(--card-radius)]"
    />
    <div
      v-else
      class="rounded-[var(--card-radius)] ring-2 ring-default bg-default overflow-x-auto"
    >
      <table
        v-if="tab === 'exams'"
        class="w-full text-sm min-w-[40rem]"
      >
        <thead>
          <tr class="border-b-2 border-default text-left text-xs font-extrabold uppercase tracking-wide text-muted">
            <th class="px-4 py-3">
              {{ t('builder.learner') }}
            </th>
            <th class="px-4 py-3">
              {{ t('tp.testSkill') }}
            </th>
            <th class="px-4 py-3">
              {{ t('tp.score') }}
            </th>
            <th class="px-4 py-3">
              {{ t('tp.status') }}
            </th>
            <th class="px-4 py-3">
              {{ t('tp.date') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="r in pageOf(exams)"
            :key="r.id"
            class="hover:bg-elevated/40"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2 min-w-0">
                <UAvatar
                  :src="r.avatarUrl ?? undefined"
                  :alt="r.studentName"
                  size="xs"
                />
                <div class="min-w-0">
                  <p class="font-bold text-highlighted truncate">
                    {{ r.studentName }}
                  </p>
                  <p
                    v-if="!oneClass && r.classes.length"
                    class="text-xs text-muted truncate"
                  >
                    {{ r.classes.join(', ') }}
                  </p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <NuxtLink
                :to="r.to"
                class="text-highlighted hover:text-primary font-semibold"
              >
                {{ r.testTitle }}
              </NuxtLink>
              <p class="text-xs text-muted">
                {{ skillLabel(r.skill) }} · {{ r.exam === 'IELTS' ? 'IELTS' : (r.cefrLevel || 'CEFR') }}
              </p>
            </td>
            <td class="px-4 py-3 font-extrabold tabular-nums">
              {{ scoreText(r) }}
            </td>
            <td class="px-4 py-3">
              <UBadge
                :label="r.status === 'GRADED' ? t('res.graded') : r.status === 'SAVED' ? t('res.aiChecked') : t('res.waiting')"
                :color="r.status === 'GRADED' ? 'success' : r.status === 'SAVED' ? 'info' : 'warning'"
                variant="soft"
                size="sm"
              />
            </td>
            <td class="px-4 py-3 text-xs text-muted whitespace-nowrap">
              {{ day(r.submittedAt) }}
            </td>
          </tr>
          <tr v-if="!exams.length">
            <td
              colspan="5"
              class="py-10 text-center text-muted"
            >
              {{ t('tp.noExamResults') }}
            </td>
          </tr>
        </tbody>
      </table>

      <table
        v-else
        class="w-full text-sm min-w-[40rem]"
      >
        <thead>
          <tr class="border-b-2 border-default text-left text-xs font-extrabold uppercase tracking-wide text-muted">
            <th class="px-4 py-3">
              {{ t('builder.learner') }}
            </th>
            <th class="px-4 py-3">
              {{ t('res.courseLesson') }}
            </th>
            <th class="px-4 py-3">
              {{ t('tp.score') }}
            </th>
            <th class="px-4 py-3">
              {{ t('tp.outcome') }}
            </th>
            <th class="px-4 py-3">
              {{ t('tp.submitted') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="e in pageOf(quizzes)"
            :key="e.id"
            class="hover:bg-elevated/40"
          >
            <td class="px-4 py-3">
              <div class="flex items-center gap-2 min-w-0">
                <UAvatar
                  :src="e.avatarUrl ?? undefined"
                  :alt="e.studentName"
                  size="xs"
                />
                <div class="min-w-0">
                  <p class="font-bold text-highlighted truncate">
                    {{ e.studentName }}
                  </p>
                  <p
                    v-if="!oneClass && e.classes.length"
                    class="text-xs text-muted truncate"
                  >
                    {{ e.classes.join(', ') }}
                  </p>
                </div>
              </div>
            </td>
            <td class="px-4 py-3">
              <p class="font-semibold text-highlighted">
                {{ e.exerciseTitle }}
              </p>
              <p class="text-xs text-muted">
                {{ e.courseTitle }} · {{ e.lessonTitle }}
              </p>
            </td>
            <td class="px-4 py-3 font-extrabold tabular-nums">
              {{ e.score }}% <span class="text-xs font-normal text-muted">({{ e.earnedPoints }}/{{ e.totalPoints }})</span>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap items-center gap-1.5">
                <UBadge
                  :label="e.passed ? t('tdash.passed') : t('tp.tryAgain')"
                  :color="e.passed ? 'success' : 'warning'"
                  variant="soft"
                  size="sm"
                />
                <UButton
                  v-if="e.reviewStatus"
                  :label="e.reviewStatus === 'TEACHER' ? t('res.marked') : e.reviewStatus === 'PENDING' ? t('res.needsMark') : t('res.review')"
                  :icon="e.reviewStatus === 'TEACHER' ? 'i-lucide-user-check' : 'i-lucide-pen-line'"
                  size="xs"
                  :color="e.reviewStatus === 'PENDING' ? 'warning' : e.reviewStatus === 'TEACHER' ? 'neutral' : 'primary'"
                  :variant="e.reviewStatus === 'TEACHER' ? 'ghost' : 'soft'"
                  data-testid="open-review"
                  @click="review(e.id)"
                />
              </div>
            </td>
            <td class="px-4 py-3 text-xs text-muted whitespace-nowrap">
              {{ day(e.submittedAt) }}
            </td>
          </tr>
          <tr v-if="!quizzes.length">
            <td
              colspan="5"
              class="py-10 text-center text-muted"
            >
              {{ t('tp.noQuizResults') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <TeacherWrittenReview
      v-model:open="reviewOpen"
      :attempt-id="reviewing"
      @saved="refresh()"
    />
    <UPagination
      v-if="rows.length > PAGE"
      v-model:page="page"
      :total="rows.length"
      :items-per-page="PAGE"
      class="self-center"
    />
  </div>
</template>
