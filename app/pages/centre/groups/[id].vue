<script setup lang="ts">
/**
 * One group for its teachers: the join link, each student's level per skill and activity (opening
 * their results), and assignments with who has done them.
 */
useSeoMeta({ title: 'Group', robots: 'noindex' })

interface Student { id: string, name: string, avatarUrl: string | null, joinedAt: string, attempts: number, lastActive: string | null, level: Record<string, number | null> }
interface AssignmentRow { id: string, skill: string, partNumber: number | null, note: string | null, dueAt: string | null, createdAt: string, test: { slug: string, title: string } | null, to: string | null, done: number, of: number, average: number | null }
interface GroupView { id: string, name: string, joinCode: string, archived: boolean, role: string, centre: { id: string, name: string }, students: Student[], assignments: AssignmentRow[] }
interface Detail extends AssignmentRow { students: { id: string, name: string, handIn: { attemptId: string, score: number | null, status: string, at: string } | null }[] }

const route = useRoute()
const toast = useToast()
const config = useRuntimeConfig()
const site = String(config.public.siteUrl || '').replace(/\/$/, '')
const id = computed(() => String(route.params.id))
const { data, refresh, error } = await useFetch<GroupView>(() => `/api/groups/${id.value}`)
useSeoMeta({ title: () => data.value?.name ?? 'Group' })

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING']
const tab = ref<'students' | 'assignments'>('students')
const tabs = computed(() => [
  { label: `Students (${data.value?.students.length ?? 0})`, value: 'students', icon: 'i-lucide-users' },
  { label: `Assignments (${data.value?.assignments.length ?? 0})`, value: 'assignments', icon: 'i-lucide-list-checks' }
])
const levelColor = (s: number | null) => (s == null ? 'text-dimmed' : s >= 65 ? 'text-success' : s >= 51 ? 'text-primary' : s >= 38 ? 'text-warning' : 'text-error')

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
    toast.add({ title: 'Not changed', description: errorMessage(e), color: 'error' })
  }
}
function rename() {
  const n = prompt('Group name', data.value?.name)
  if (n?.trim()) patch({ name: n }, 'Renamed')
}
const menu = computed(() => [[
  { label: 'Rename', icon: 'i-lucide-pencil', onSelect: rename },
  { label: 'New join code', icon: 'i-lucide-refresh-cw', onSelect: () => patch({ newCode: true }, 'New code made: the old link no longer works') },
  { label: data.value?.archived ? 'Bring back' : 'Archive', icon: 'i-lucide-archive', onSelect: () => patch({ archived: !data.value?.archived }, data.value?.archived ? 'Back in the list' : 'Archived') }
]])
async function removeStudent(s: Student) {
  if (!confirm(`Take ${s.name} out of this group? Their seat is freed if they are in no other group.`)) return
  try {
    await $fetch(`/api/groups/${id.value}/students/${s.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not removed', description: errorMessage(e), color: 'error' })
  }
}

// ---- new assignment ----
const { data: testList } = await useFetch<{ items: { id: string, title: string, sections: { skill: string, items: number }[] }[] }>('/api/tests', { query: { limit: 60 }, lazy: true })
const form = ref<{ testId: string | undefined, skill: string, part: number | 0, dueAt: string, note: string } | null>(null)
const saving = ref(false)
const testItems = computed(() => (testList.value?.items ?? []).map(t => ({ label: t.title, value: t.id })))
const skillItems = computed(() => {
  const t = testList.value?.items.find(x => x.id === form.value?.testId)
  return SKILLS.filter(s => !t || t.sections.some(x => x.skill === s && x.items)).map(s => ({ label: skillLabel(s), value: s }))
})
const partItems = computed(() => [{ label: 'The whole section', value: 0 }, ...(PART_NUMBERS[form.value?.skill ?? ''] ?? []).map(n => ({ label: partName(form.value!.skill, n), value: n }))])
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
    toast.add({ title: 'Assignment set', description: 'Students with Telegram got a message.', color: 'success' })
    form.value = null
    tab.value = 'assignments'
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not set', description: errorMessage(e), color: 'error' })
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
    toast.add({ title: 'Could not open it', description: errorMessage(e), color: 'error' })
  }
}
async function removeAssignment(a: AssignmentRow) {
  if (!confirm('Remove this assignment? What students handed in stays in their results.')) return
  await $fetch(`/api/assignments/${a.id}`, { method: 'DELETE' }).catch(e => toast.add({ title: 'Not removed', description: errorMessage(e), color: 'error' }))
  detail.value = null
  await refresh()
}
const what = (a: AssignmentRow) => `${skillLabel(a.skill)}${a.partNumber ? ` ${partName(a.skill, a.partNumber)}` : ''}`
const overdue = (a: AssignmentRow) => !!a.dueAt && new Date(a.dueAt) < new Date() && a.done < a.of
</script>

<template>
  <AppPage
    :title="data?.name ?? 'Group'"
    icon="i-lucide-users"
  >
    <template #actions>
      <UButton
        to="/centre"
        label="Centre"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
      />
      <UButton
        v-if="data && !data.archived"
        label="Set work"
        icon="i-lucide-plus"
        @click="startAssign"
      />
    </template>

    <UEmpty
      v-if="error"
      icon="i-lucide-users"
      title="Group not found"
      :actions="[{ label: 'My centre', to: '/centre' }]"
    />

    <div
      v-else-if="data"
      class="flex flex-col gap-4 max-w-5xl w-full"
    >
      <div class="flex flex-col sm:flex-row sm:items-end gap-3">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-muted">
            {{ data.centre.name }}
          </p>
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
            {{ data.name }}
          </h1>
        </div>
        <UDropdownMenu
          :items="menu"
        >
          <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="outline"
            aria-label="Group options"
          />
        </UDropdownMenu>
      </div>

      <UCard
        v-if="!data.archived"
        variant="subtle"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-3 p-4' }"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-highlighted">
            Students join with this link
          </p>
          <p class="text-xs text-muted truncate">
            {{ site }}/join/{{ data.joinCode }} · or the code <span class="font-mono font-semibold">{{ data.joinCode }}</span> on their Profile
          </p>
        </div>
        <UButton
          label="Copy link"
          icon="i-lucide-link"
          size="sm"
          @click="copy(`${site}/join/${data.joinCode}`, 'Join link copied')"
        />
      </UCard>

      <UTabs
        v-model="tab"
        :items="tabs"
        :content="false"
        class="w-full sm:w-auto"
      />

      <!-- Students -->
      <template v-if="tab === 'students'">
        <UEmpty
          v-if="!data.students.length"
          icon="i-lucide-user-plus"
          title="No students yet"
          description="Share the join link with the class."
        />
        <div
          v-else
          class="rounded-xl ring ring-default overflow-x-auto"
        >
          <table class="w-full text-sm">
            <thead class="bg-elevated/50 text-xs text-muted">
              <tr>
                <th class="text-left font-medium px-4 py-2">
                  Student
                </th>
                <th
                  v-for="s in SKILLS"
                  :key="s"
                  class="text-center font-medium px-2 py-2"
                >
                  {{ skillLabel(s) }}
                </th>
                <th class="text-right font-medium px-3 py-2">
                  Tests
                </th>
                <th class="text-right font-medium px-3 py-2">
                  Last active
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
                  :class="levelColor(s.level[k] ?? null)"
                >
                  {{ s.level[k] ?? '—' }}
                </td>
                <td class="text-right px-3 py-2.5 tabular-nums">
                  {{ s.attempts }}
                </td>
                <td class="text-right px-3 py-2.5 text-muted whitespace-nowrap">
                  {{ s.lastActive ? relativeTime(s.lastActive) : 'Not yet' }}
                </td>
                <td class="px-2">
                  <UButton
                    icon="i-lucide-user-minus"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :aria-label="`Take ${s.name} out of the group`"
                    @click="removeStudent(s)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
          <p class="text-xs text-muted px-4 py-2 border-t border-default">
            Scores out of 75: the average of each student's last three whole sections.
          </p>
        </div>
      </template>

      <!-- Assignments -->
      <template v-else>
        <UEmpty
          v-if="!data.assignments.length"
          icon="i-lucide-list-checks"
          title="No assignments yet"
          description="Set a section of a test, or one part, with a due date. Students get a Telegram message."
          :actions="data.archived ? [] : [{ label: 'Set work', icon: 'i-lucide-plus', onClick: startAssign }]"
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
                {{ what(a) }} · {{ a.test?.title ?? 'Removed test' }}
              </p>
              <p
                class="text-xs truncate"
                :class="overdue(a) ? 'text-error' : 'text-muted'"
              >
                {{ a.dueAt ? `Due ${formatDate(a.dueAt, true)}` : 'No due date' }}{{ a.note ? ` · ${a.note}` : '' }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-highlighted tabular-nums">
                {{ a.done }}/{{ a.of }}
              </p>
              <p class="text-xs text-muted">
                {{ a.average != null ? `avg ${a.average}` : 'done' }}
              </p>
            </div>
          </button>
        </div>
      </template>
    </div>

    <!-- New assignment -->
    <UModal
      :open="!!form"
      title="Set work"
      @update:open="v => !v && (form = null)"
    >
      <template #body>
        <form
          v-if="form"
          class="grid gap-4"
          @submit.prevent="assign"
        >
          <UFormField label="Test">
            <USelectMenu
              v-model="form.testId"
              :items="testItems"
              value-key="value"
              placeholder="Pick a test"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Section">
              <USelect
                v-model="form.skill"
                :items="skillItems"
                class="w-full"
                @update:model-value="form.part = 0"
              />
            </UFormField>
            <UFormField label="Part">
              <USelect
                v-model="form.part"
                :items="partItems"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Due"
            help="Optional."
          >
            <UInput
              v-model="form.dueAt"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Note for students"
            help="Optional."
          >
            <UTextarea
              v-model="form.note"
              :rows="2"
              class="w-full"
              placeholder="e.g. Time yourself, and read the explanations afterwards."
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="form = null"
            />
            <UButton
              type="submit"
              label="Set it"
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
      :description="detail ? `${detail.done} of ${detail.of} done${detail.average != null ? `, average ${detail.average}/75` : ''}` : ''"
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
                  :label="s.handIn.score != null ? `${s.handIn.score}/75` : 'With an examiner'"
                  size="xs"
                  color="neutral"
                  variant="outline"
                />
              </template>
              <span
                v-else
                class="text-xs text-muted"
              >Not yet</span>
            </li>
          </ul>
          <div class="flex justify-between">
            <UButton
              label="Remove assignment"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="removeAssignment(detail)"
            />
            <UButton
              v-if="detail.to"
              :to="detail.to"
              label="Open the test"
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
