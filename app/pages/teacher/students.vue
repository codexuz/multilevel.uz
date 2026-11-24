<script setup lang="ts">
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
useSeoMeta({ title: 'Students · Teacher Panel', robots: 'noindex' })

interface StudentRow {
  id: string
  name: string
  email: string | null
  telegramUsername: string | null
  avatarUrl: string | null
  level: string | null
  groups: Array<{ id: string, name: string, level: string | null }>
  examAttempts: number
  exerciseAttempts: number
  avgExerciseScore: number | null
  lastActive: string | null
}

const route = useRoute()
const search = ref(String(route.query.q ?? ''))
const groupFilter = ref('ALL')

const { data, status } = await useFetch<{ students: StudentRow[], groups: Array<{ id: string, name: string, level: string | null }> }>('/api/teacher/students', {
  default: () => ({ students: [], groups: [] })
})

const groupOptions = computed(() => [
  { label: 'All Groups', value: 'ALL' },
  ...data.value.groups.map(g => ({ label: g.name, value: g.id }))
])

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return data.value.students.filter((s) => {
    if (groupFilter.value !== 'ALL' && !s.groups.some(g => g.id === groupFilter.value)) return false
    if (!q) return true
    return s.name.toLowerCase().includes(q)
      || (s.email ?? '').toLowerCase().includes(q)
      || (s.telegramUsername ?? '').toLowerCase().includes(q)
  })
})
</script>

<template>
  <AppPage
    title="My Students"
    icon="i-lucide-user-round"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Search student by name, email or @handle..."
          class="w-full sm:w-80"
        />
        <USelect
          v-model="groupFilter"
          :items="groupOptions"
          class="w-48"
        />
        <span class="ms-auto text-xs text-muted">{{ filtered.length }} student(s)</span>
      </div>

      <UCard :ui="{ body: 'p-0' }">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-default text-left text-xs font-semibold text-muted">
                <th class="px-4 py-3">
                  Student
                </th>
                <th class="px-4 py-3">
                  Groups
                </th>
                <th class="px-4 py-3">
                  Level
                </th>
                <th class="px-4 py-3">
                  Exam Attempts
                </th>
                <th class="px-4 py-3">
                  LMS Exercises
                </th>
                <th class="px-4 py-3">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default/60">
              <tr v-if="status === 'pending' && !filtered.length">
                <td
                  colspan="6"
                  class="p-5"
                >
                  <USkeleton class="h-10 w-full rounded-lg" />
                </td>
              </tr>
              <tr
                v-for="s in filtered"
                :key="s.id"
                class="hover:bg-elevated/40"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <UAvatar
                      :src="s.avatarUrl ?? undefined"
                      :alt="s.name"
                      size="sm"
                    />
                    <div class="min-w-0">
                      <p class="font-medium text-highlighted truncate">
                        {{ s.name }}
                      </p>
                      <p class="text-xs text-muted truncate">
                        {{ s.email || (s.telegramUsername ? `@${s.telegramUsername}` : '') }}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <NuxtLink
                      v-for="g in s.groups"
                      :key="g.id"
                      :to="`/classes/${g.id}`"
                    >
                      <UBadge
                        :label="g.name"
                        color="neutral"
                        variant="subtle"
                        size="xs"
                      />
                    </NuxtLink>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <UBadge
                    v-if="s.level"
                    :label="s.level"
                    color="primary"
                    variant="subtle"
                    size="xs"
                  />
                  <span
                    v-else
                    class="text-xs text-dimmed"
                  >—</span>
                </td>
                <td class="px-4 py-3 tabular-nums font-medium">
                  {{ s.examAttempts }}
                </td>
                <td class="px-4 py-3 text-xs tabular-nums">
                  <span class="font-medium text-highlighted">{{ s.exerciseAttempts }}</span>
                  <span
                    v-if="s.avgExerciseScore != null"
                    class="text-muted"
                  > · avg {{ s.avgExerciseScore }}%</span>
                </td>
                <td class="px-4 py-3 text-xs text-muted">
                  {{ s.lastActive ? new Date(s.lastActive).toLocaleDateString() : '—' }}
                </td>
              </tr>
              <tr v-if="!filtered.length && status !== 'pending'">
                <td
                  colspan="6"
                  class="py-10 text-center text-muted"
                >
                  No students yet. Share a group join link from My Groups.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </AppPage>
</template>
