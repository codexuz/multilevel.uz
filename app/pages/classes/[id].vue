<script setup lang="ts">
/**
 * One class for its teacher: the join link, each student's level per skill and activity (opening
 * their results), and assignments with who has done them.
 */
const { t } = useI18n()
const { confirm, prompt } = useDialogs()
useSeoMeta({ title: () => t('classes.class'), robots: 'noindex' })

interface Student { id: string, name: string, avatarUrl: string | null, joinedAt: string, attempts: number, lastActive: string | null, level: Record<string, number | null>, bands?: string[] }
interface AssignmentRow { id: string, skill: string, partNumber: number | null, note: string | null, dueAt: string | null, createdAt: string, test: { slug: string, title: string } | null, to: string | null, exam: string, done: number, of: number, average: number | null }
interface GroupView { id: string, name: string, exam: 'IELTS' | 'MULTILEVEL', level?: string | null, joinCode: string, archived: boolean, students: Student[], assignments: AssignmentRow[] }
interface Detail extends AssignmentRow { students: { id: string, name: string, handIn: { attemptId: string, score: number | null, band: number | null, status: string, at: string } | null }[] }

const route = useRoute()
// Just made in onboarding or on /teach: say what to do first.
const welcome = computed(() => route.query.welcome === '1')
const toast = useToast()
const config = useRuntimeConfig()
const site = String(config.public.siteUrl || '').replace(/\/$/, '')
const id = computed(() => String(route.params.id))
const { data, refresh, error } = await useFetch<GroupView>(() => `/api/groups/${id.value}`)
useSeoMeta({ title: () => data.value?.name ?? t('classes.class') })

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']
// ?tab=online (back from connecting Google) opens the online classes.
const TABS = ['students', 'results', 'assignments', 'vocabulary', 'online'] as const
const tab = ref<typeof TABS[number]>(route.query.google ? 'online' : TABS.find(x => x === route.query.tab) ?? 'students')
const tabs = computed(() => [
  { label: t('centre.studentsTab', { n: data.value?.students.length ?? 0 }), value: 'students', icon: 'i-lucide-users' },
  { label: t('res.tab'), value: 'results', icon: 'i-lucide-chart-column' },
  { label: t('centre.assignmentsTab', { n: data.value?.assignments.length ?? 0 }), value: 'assignments', icon: 'i-lucide-list-checks' },
  { label: t('vocab.classTab'), value: 'vocabulary', icon: 'i-lucide-layers' },
  { label: t('online.tab'), value: 'online', icon: 'i-lucide-video' }
])
// Back from connecting Google: say how it went.
onMounted(() => {
  const g = route.query.google
  if (g === 'connected') toast.add({ title: t('online.connectedToast'), color: 'success' })
  else if (g === 'scope') toast.add({ title: t('online.scopeToast'), color: 'warning' })
  else if (g === 'failed') toast.add({ title: t('online.failedToast'), color: 'error' })
})
const levelColor = (s: number | null) => (s == null ? 'text-dimmed' : s >= 65 ? 'text-success' : s >= 51 ? 'text-primary' : s >= 38 ? 'text-warning' : 'text-error')
const bandColor = (b: number | null) => (b == null ? 'text-dimmed' : b >= 7 ? 'text-success' : b >= 5.5 ? 'text-primary' : b >= 4 ? 'text-warning' : 'text-error')

async function copy(text: string, title: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title, description: text, color: 'success' })
  } catch {}
}
async function patch(body: Record<string, unknown>, done: string) {
  try {
    await $fetch(`/api/groups/${id.value}`, { method: 'PATCH', body })
    toast.add({ title: done, color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('centre.notChanged'), description: errorMessage(e), color: 'error' })
  }
}
async function rename() {
  const n = await prompt({ title: t('centre.rename'), label: t('centre.groupName'), initialValue: data.value?.name, confirmLabel: t('common.save') })
  if (n?.trim()) patch({ name: n }, t('centre.renamed'))
}
const groupExam = computed<'IELTS' | 'MULTILEVEL'>(() => (data.value?.exam === 'IELTS' ? 'IELTS' : 'MULTILEVEL'))
const menu = computed(() => [[
  { label: t('centre.rename'), icon: 'i-lucide-pencil', onSelect: rename },
  {
    label: groupExam.value === 'IELTS' ? 'Switch group type to CEFR' : 'Switch group type to IELTS',
    icon: 'i-lucide-arrow-left-right',
    onSelect: () => patch({ exam: groupExam.value === 'IELTS' ? 'MULTILEVEL' : 'IELTS' }, 'Group exam type updated')
  },
  { label: t('centre.newCode'), icon: 'i-lucide-refresh-cw', onSelect: () => patch({ newCode: true }, t('centre.newCodeDone')) },
  { label: data.value?.archived ? t('centre.bringBack') : t('centre.archive'), icon: 'i-lucide-archive', onSelect: () => patch({ archived: !data.value?.archived }, data.value?.archived ? t('centre.backInList') : t('centre.archived')) }
]])
async function removeStudent(s: Student) {
  if (!await confirm({ title: t('centre.removeStudentSure', { name: s.name }), confirmLabel: t('centre.takeOut'), color: 'error' })) return
  try {
    await $fetch(`/api/groups/${id.value}/students/${s.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('centre.notRemoved'), description: errorMessage(e), color: 'error' })
  }
}

// ---- new assignment (fetches ONLY tests matching this group's exam type: IELTS or CEFR) ----
const testQuery = computed(() => ({ limit: 100, exam: groupExam.value }))
const { data: testList } = await useFetch<{ items: { id: string, title: string, sections: { skill: string, items: number, silentParts?: number[] }[] }[] }>('/api/tests', { query: testQuery, lazy: true })
const form = ref<{ testId: string | undefined, skill: string, part: number | 0, dueAt: string, note: string } | null>(null)
const saving = ref(false)
const testItems = computed(() => (testList.value?.items ?? []).map(t => ({ label: t.title, value: t.id })))
const skillItems = computed(() => {
  const t = testList.value?.items.find(x => x.id === form.value?.testId)
  return SKILLS.filter(s => !t || t.sections.some(x => x.skill === s && x.items)).map(s => ({ label: skillLabel(s), value: s }))
})
// Listening parts with no recording of their own are heard only in the whole test: not set alone.
const silent = computed(() => testList.value?.items.find(x => x.id === form.value?.testId)?.sections.find(x => x.skill === form.value?.skill)?.silentParts ?? [])
const partItems = computed(() => [{ label: t('centre.wholeSection'), value: 0 }, ...partNumbers(form.value?.skill ?? 'READING', groupExam.value).map(n => ({
  label: silent.value.includes(n) ? `${partName(form.value!.skill, n, groupExam.value)} · ${t('tests.noAudioShort')}` : partName(form.value!.skill, n, groupExam.value),
  value: n,
  disabled: silent.value.includes(n)
}))])
watch(silent, (s) => {
  if (form.value?.part && s.includes(form.value.part)) form.value.part = 0
})
watch(() => form.value?.testId, () => {
  if (form.value && !skillItems.value.some(s => s.value === form.value!.skill)) form.value.skill = skillItems.value[0]?.value ?? 'READING'
})
function startAssign() {
  const week = new Date(Date.now() + 7 * 864e5)
  form.value = { testId: undefined, skill: 'READING', part: 0, dueAt: `${week.toISOString().slice(0, 10)}T20:00`, note: '' }
}
async function assign() {
  const f = form.value
  if (!f?.testId) return
  saving.value = true
  try {
    await $fetch(`/api/groups/${id.value}/assignments`, { method: 'POST', body: { testId: f.testId, skill: f.skill, partNumber: f.part || null, dueAt: f.dueAt ? new Date(f.dueAt).toISOString() : null, note: f.note } })
    toast.add({ title: t('centre.assignmentSet'), description: t('centre.assignmentSetText'), color: 'success' })
    form.value = null
    tab.value = 'assignments'
    await refresh()
  } catch (e) {
    toast.add({ title: t('centre.notSet'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---- one assignment ----
const detail = ref<Detail | null>(null)
async function openAssignment(a: AssignmentRow) {
  try {
    detail.value = await $fetch<Detail>(`/api/assignments/${a.id}`)
  } catch (e) {
    toast.add({ title: t('centre.couldNotOpen'), description: errorMessage(e), color: 'error' })
  }
}
async function removeAssignment(a: AssignmentRow) {
  if (!await confirm({ title: t('centre.removeAssignmentTitle'), description: t('centre.removeAssignmentSure'), confirmLabel: t('centre.removeAssignment'), color: 'error' })) return
  await $fetch(`/api/assignments/${a.id}`, { method: 'DELETE' }).catch(e => toast.add({ title: t('centre.notRemoved'), description: errorMessage(e), color: 'error' }))
  detail.value = null
  await refresh()
}
const what = (a: AssignmentRow) => `${skillLabel(a.skill)}${a.partNumber ? ` ${partName(a.skill, a.partNumber, a.exam)}` : ''}`
const overdue = (a: AssignmentRow) => !!a.dueAt && new Date(a.dueAt) < new Date() && a.done < a.of
</script>

<template>
  <AppPage
    :title="data?.name ?? t('classes.class')"
    icon="i-lucide-users"
  >
    <template #actions>
      <UButton
        to="/classes"
        :label="t('nav.classes')"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
      />
      <UButton
        v-if="data && !data.archived"
        :label="t('centre.setWork')"
        icon="i-lucide-plus"
        @click="startAssign"
      />
    </template>

    <UEmpty
      v-if="error"
      icon="i-lucide-users"
      :title="t('centre.groupNotFound')"
      :actions="[{ label: t('nav.classes'), to: '/classes' }]"
    />

    <div
      v-else-if="data"
      class="flex flex-col gap-4 max-w-5xl w-full"
    >
      <div class="flex flex-col sm:flex-row sm:items-end gap-3">
        <div class="flex-1 min-w-0 flex flex-wrap items-center gap-2.5">
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
            {{ data.name }}
          </h1>
          <UBadge
            :label="groupExam === 'IELTS' ? 'IELTS Group' : 'CEFR Group'"
            :color="groupExam === 'IELTS' ? 'error' : 'primary'"
            variant="subtle"
          />
        </div>
        <UDropdownMenu
          :items="menu"
        >
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="outline"
            :aria-label="t('centre.groupOptions')"
          />
        </UDropdownMenu>
      </div>

      <UAlert
        v-if="welcome && !data.students.length"
        color="primary"
        variant="subtle"
        icon="i-lucide-party-popper"
        :title="t('classes.welcomeTitle')"
        :description="t('classes.welcomeText')"
        data-testid="class-welcome"
      />

      <UCard
        v-if="!data.archived"
        variant="subtle"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-3 p-4' }"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-highlighted">
            {{ t('centre.joinWithLink') }}
          </p>
          <p class="text-xs text-muted truncate">
            {{ site }}/join/{{ data.joinCode }} · {{ t('centre.orCode') }} <span class="font-mono font-semibold">{{ data.joinCode }}</span>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            :label="t('share.copyLink')"
            icon="i-lucide-link"
            size="sm"
            @click="copy(`${site}/join/${data.joinCode}`, t('centre.joinLinkCopied'))"
          />
          <UButton
            :href="`https://t.me/share/url?url=${encodeURIComponent(`${site}/join/${data.joinCode}`)}&text=${encodeURIComponent(t('classes.shareText', { name: data.name }))}`"
            target="_blank"
            rel="noopener"
            :label="t('classes.shareTelegram')"
            icon="i-simple-icons-telegram"
            size="sm"
            color="neutral"
            variant="outline"
            data-testid="share-telegram"
          />
        </div>
      </UCard>

      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full sm:w-auto"
      />

      <!-- Online classes (Google Meet) -->
      <OnlinePanel
        v-if="tab === 'online'"
        :group-id="data.id"
        :next="`/classes/${data.id}?tab=online`"
      />

      <!-- Results: this class's test results and course quiz answers -->
      <template v-if="tab === 'results'">
        <div class="flex justify-end -mb-2">
          <UButton
            :to="`/teacher/results?class=${data.id}`"
            :label="t('res.inResults')"
            trailing-icon="i-lucide-arrow-up-right"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </div>
        <TeacherResultsBoard :group-id="data.id" />
      </template>

      <!-- Vocabulary: each student's progress in the class's decks -->
      <VocabClassTable
        v-if="tab === 'vocabulary'"
        :group-id="data.id"
      />

      <!-- Students -->
      <template v-if="tab === 'students'">
        <UEmpty
          v-if="!data.students.length"
          icon="i-lucide-user-plus"
          :title="t('centre.noStudents')"
          :description="t('centre.noStudentsText')"
        />
        <div
          v-else
          class="rounded-xl ring ring-default overflow-x-auto"
        >
          <table class="w-full text-sm">
            <thead class="bg-elevated/50 text-xs text-muted">
              <tr>
                <th class="text-left font-medium px-4 py-2">
                  {{ t('centre.student') }}
                </th>
                <th
                  v-for="s in SKILLS"
                  :key="s"
                  class="text-center font-medium px-2 py-2"
                >
                  {{ skillLabel(s) }}
                </th>
                <th class="text-right font-medium px-3 py-2">
                  {{ t('nav.tests') }}
                </th>
                <th class="text-right font-medium px-3 py-2">
                  {{ t('centre.lastActive') }}
                </th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="s in data.students"
                :key="s.id"
              >
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2 min-w-36">
                    <UAvatar
                      :src="s.avatarUrl ?? undefined"
                      :alt="s.name"
                      size="xs"
                    />
                    <span class="font-medium text-highlighted truncate">{{ s.name }}</span>
                  </div>
                </td>
                <td
                  v-for="k in SKILLS"
                  :key="k"
                  class="text-center px-2 py-2.5 tabular-nums font-semibold"
                  :class="s.bands?.includes(k) ? bandColor(s.level[k] ?? null) : levelColor(s.level[k] ?? null)"
                >
                  {{ s.bands?.includes(k) ? fmtBand(s.level[k]) : s.level[k] ?? '—' }}
                </td>
                <td class="text-right px-3 py-2.5 tabular-nums">
                  {{ s.attempts }}
                </td>
                <td class="text-right px-3 py-2.5 text-muted whitespace-nowrap">
                  {{ s.lastActive ? relativeTime(s.lastActive) : t('common.notYet') }}
                </td>
                <td class="px-2">
                  <UButton
                    icon="i-lucide-user-minus"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t('centre.removeStudent', { name: s.name })"
                    @click="removeStudent(s)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="text-xs text-muted px-4 py-2 border-t border-default">
            {{ t(data?.students.some(s => s.bands?.length) ? 'centre.scoresNoteBands' : 'centre.scoresNote') }}
          </p>
        </div>
      </template>

      <!-- Assignments -->
      <template v-else-if="tab === 'assignments'">
        <UEmpty
          v-if="!data.assignments.length"
          icon="i-lucide-list-checks"
          :title="t('centre.noAssignments')"
          :description="t('centre.noAssignmentsText')"
          :actions="data.archived ? [] : [{ label: t('centre.setWork'), icon: 'i-lucide-plus', onClick: startAssign }]"
        />
        <div
          v-else
          class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
        >
          <button
            v-for="a in data.assignments"
            :key="a.id"
            type="button"
            class="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            @click="openAssignment(a)"
          >
            <img
              :src="SKILL_ART[a.skill]"
              alt=""
              class="size-8 shrink-0"
            >
            <div class="flex-1 min-w-0">
              <p class="font-medium text-highlighted truncate">
                {{ what(a) }} · {{ a.test?.title ?? t('centre.removedTest') }}
              </p>
              <p
                class="text-xs truncate"
                :class="overdue(a) ? 'text-error' : 'text-muted'"
              >
                {{ a.dueAt ? t('centre.due', { date: formatDate(a.dueAt, true) }) : t('centre.noDue') }}{{ a.note ? ` · ${a.note}` : '' }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-highlighted tabular-nums">
                {{ a.done }}/{{ a.of }}
              </p>
              <p class="text-xs text-muted">
                {{ a.average != null ? t('centre.avg', { n: a.exam === 'IELTS' ? fmtBand(a.average) : a.average }) : t('centre.doneWord') }}
              </p>
            </div>
          </button>
        </div>
      </template>
    </div>

    <!-- New assignment -->
    <UModal
      :open="!!form"
      :title="t('centre.setWork')"
      @update:open="v => !v && (form = null)"
    >
      <template #body>
        <form
          v-if="form"
          class="grid gap-4"
          @submit.prevent="assign"
        >
          <UFormField :label="t('sit.test')">
            <USelectMenu
              v-model="form.testId"
              :items="testItems"
              value-key="value"
              :placeholder="t('centre.pickTest')"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('centre.section')">
              <USelect
                v-model="form.skill"
                :items="skillItems"
                class="w-full"
                @update:model-value="form.part = 0"
              />
            </UFormField>
            <UFormField :label="t('part.partWord')">
              <USelect
                v-model="form.part"
                :items="partItems"
                class="w-full"
                data-testid="assign-part"
              />
            </UFormField>
          </div>
          <UAlert
            v-if="silent.length"
            icon="i-lucide-headphone-off"
            color="warning"
            variant="subtle"
            :description="t('centre.noAudioParts', { parts: silent.map(n => partName(form!.skill, n, groupExam)).join(', ') })"
            data-testid="assign-no-audio"
          />
          <UFormField
            :label="t('centre.dueLabel')"
            :help="t('centre.optional')"
          >
            <UInput
              v-model="form.dueAt"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('centre.noteLabel')"
            :help="t('centre.optional')"
          >
            <UTextarea
              v-model="form.note"
              :rows="2"
              class="w-full"
              :placeholder="t('centre.notePlaceholder')"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="form = null"
            />
            <UButton
              type="submit"
              :label="t('centre.setIt')"
              :loading="saving"
              :disabled="!form.testId"
            />
          </div>
        </form>
      </template>
    </UModal>

    <!-- One assignment -->
    <UModal
      :open="!!detail"
      :title="detail ? `${what(detail)} · ${detail.test?.title ?? ''}` : ''"
      :description="detail ? `${t('centre.doneOf', { done: detail.done, of: detail.of })}${detail.average != null ? `, ${detail.exam === 'IELTS' ? t('centre.averageBand', { n: fmtBand(detail.average) }) : t('centre.average', { n: detail.average })}` : ''}` : ''"
      @update:open="v => !v && (detail = null)"
    >
      <template #body>
        <div
          v-if="detail"
          class="flex flex-col gap-3"
        >
          <ul class="divide-y divide-default">
            <li
              v-for="s in detail.students"
              :key="s.id"
              class="flex items-center gap-3 py-2"
            >
              <UIcon
                :name="s.handIn ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
                :class="s.handIn ? 'text-success' : 'text-dimmed'"
                class="size-5 shrink-0"
              />
              <span class="flex-1 min-w-0 truncate text-sm">{{ s.name }}</span>
              <template v-if="s.handIn">
                <span class="text-xs text-muted">{{ relativeTime(s.handIn.at) }}</span>
                <UButton
                  :to="`/results/${s.handIn.attemptId}`"
                  :label="s.handIn.band != null ? `${t('result.band')} ${fmtBand(s.handIn.band)}` : s.handIn.score != null ? `${s.handIn.score}/75` : s.handIn.status === 'AWAITING_CREDIT' ? t('result.notSentBadge') : t('result.withExaminer')"
                  size="xs"
                  color="neutral"
                  variant="outline"
                />
              </template>
              <span
                v-else
                class="text-xs text-muted"
              >{{ t('common.notYet') }}</span>
            </li>
          </ul>
          <div class="flex justify-between">
            <UButton
              :label="t('centre.removeAssignment')"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="removeAssignment(detail)"
            />
            <UButton
              v-if="detail.to"
              :to="detail.to"
              :label="t('centre.openTest')"
              icon="i-lucide-external-link"
              size="sm"
              color="neutral"
              variant="outline"
            />
          </div>
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
