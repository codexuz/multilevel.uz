<script setup lang="ts">
/** The course's learners and how far each has got: lessons done, quizzes passed, their average score. */
interface Learner { id: string, name: string, avatarUrl: string | null, done: number, exercisesPassed: number, avgExerciseScore: number | null }
const props = defineProps<{ learners: Learner[], lessons: number, quizzes: number, passingScore: number, visibility: string }>()
const { t } = useI18n()
const q = ref('')
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  return s ? props.learners.filter(l => l.name.toLowerCase().includes(s)) : props.learners
})
const pct = (n: number) => (props.lessons ? Math.round(n / props.lessons * 100) : 0)
const finished = computed(() => props.learners.filter(l => props.lessons && l.done >= props.lessons).length)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-sm text-muted flex-1 min-w-56">
        {{ visibility === 'PUBLIC' ? t('courses.learnersPublic') : t('courses.learnersPrivate') }}
        <template v-if="learners.length">
          {{ t('builder.finished', { n: finished, of: learners.length }) }}
        </template>
      </p>
      <UInput
        v-if="learners.length > 6"
        v-model="q"
        icon="i-lucide-search"
        :placeholder="t('builder.findLearner')"
        class="w-full sm:w-64"
      />
    </div>

    <UCard
      v-if="learners.length"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default text-start text-xs font-medium text-muted">
              <th class="px-4 py-3 text-start">
                {{ t('builder.learner') }}
              </th>
              <th class="px-4 py-3 text-start">
                {{ t('builder.progress') }}
              </th>
              <th class="px-4 py-3 text-start">
                {{ t('builder.quizzesPassed') }}
              </th>
              <th class="px-4 py-3 text-start">
                {{ t('builder.avgScore') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="u in shown"
              :key="u.id"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <UAvatar
                    :src="u.avatarUrl ?? undefined"
                    :alt="u.name"
                    size="sm"
                  />
                  <span class="font-medium text-highlighted">{{ u.name }}</span>
                </div>
              </td>
              <td class="px-4 py-3 min-w-48">
                <div class="flex items-center gap-2">
                  <UProgress
                    :model-value="pct(u.done)"
                    size="sm"
                    class="flex-1"
                  />
                  <span class="text-xs text-muted tabular-nums w-12 text-end">{{ u.done }}/{{ lessons }}</span>
                </div>
              </td>
              <td class="px-4 py-3 tabular-nums text-toned">
                {{ quizzes ? `${u.exercisesPassed}/${quizzes}` : '—' }}
              </td>
              <td class="px-4 py-3 tabular-nums">
                <span
                  v-if="u.avgExerciseScore != null"
                  :class="u.avgExerciseScore >= passingScore ? 'text-success' : 'text-warning'"
                  class="font-medium"
                >{{ u.avgExerciseScore }}%</span>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
    <UEmpty
      v-else
      icon="i-lucide-users"
      :title="t('courses.noLearners')"
      :description="visibility === 'PUBLIC' ? t('builder.noLearnersPublic') : t('builder.noLearnersPrivate')"
      variant="outline"
    />
  </div>
</template>
