<script setup lang="ts">
import type { Paged } from '~/types/ielts'

/**
 * A public list for revising and for search engines: the Listening or Reading parts with their
 * answers explained, or the Writing tasks with their samples. Filtered by exam (and for Writing, by
 * task), in the address so a filtered list can be shared.
 */
type Kind = 'LISTENING' | 'READING' | 'WRITING'
interface Item { slug: string, title: string, exam: string, partNumber?: number, taskNumber?: number, questions?: number, samples?: number, preview: string, test: { slug: string, title: string } }

const props = defineProps<{ kind: Kind }>()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const base = `/${props.kind.toLowerCase()}`

const exam = ref<string>(isExam(route.query.exam) ? String(route.query.exam) : 'ALL')
const task = ref<string>(typeof route.query.task === 'string' ? route.query.task : 'ALL')
const page = ref(Number(route.query.page) || 1)
watch([exam, task], () => {
  page.value = 1
  if (exam.value === 'ALL') task.value = 'ALL'
})
watch([exam, task, page], () => router.replace({ query: {
  ...(exam.value !== 'ALL' ? { exam: exam.value } : {}),
  ...(task.value !== 'ALL' ? { task: task.value } : {}),
  ...(page.value > 1 ? { page: String(page.value) } : {})
} }))

const { data, status } = await useFetch<Paged<Item>>(`/api/public${base}`, {
  query: computed(() => ({ exam: exam.value === 'ALL' ? undefined : exam.value, task: task.value === 'ALL' ? undefined : task.value, page: page.value }))
})

const examTabs = computed(() => [
  { label: t('answers.allExams'), value: 'ALL' },
  { label: 'IELTS', value: 'IELTS' },
  { label: 'Multilevel', value: 'MULTILEVEL' }
])
// Writing: the tasks of the exam picked.
const taskTabs = computed(() => exam.value === 'ALL'
  ? []
  : [{ label: t('answers.allTasks'), value: 'ALL' }, ...(exam.value === 'IELTS' ? [1, 2] : [1, 2, 3]).map(n => ({ label: taskName(exam.value, n), value: String(n) }))])

const heading = computed(() => t(`answers.${props.kind.toLowerCase()}Title`))
const lead = computed(() => t(`answers.${props.kind.toLowerCase()}Lead`))
useSeoMeta({ title: heading, description: lead, ogTitle: heading, ogDescription: lead })

const label = (i: Item) => (props.kind === 'WRITING'
  ? `${examLabel(i.exam)} · ${taskName(i.exam, i.taskNumber ?? 1)}`
  : `${examLabel(i.exam)} · ${partName(props.kind, i.partNumber ?? 1, i.exam)}`)
</script>

<template>
  <AppPage
    :title="heading"
    :icon="SKILL_META[kind].icon"
  >
    <div class="flex flex-col gap-5 w-full max-w-5xl mx-auto">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ heading }}
        </h1>
        <p class="text-muted mt-1 max-w-2xl">
          {{ lead }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UTabs
          v-model="exam"
          :items="examTabs"
          :content="false"
          size="sm"
          class="w-full sm:w-auto"
        />
        <UTabs
          v-if="kind === 'WRITING' && taskTabs.length"
          v-model="task"
          :items="taskTabs"
          :content="false"
          size="sm"
          variant="link"
        />
      </div>

      <p class="text-sm text-muted -mt-2">
        {{ status === 'pending' && !data ? t('common.loading') : t(kind === 'WRITING' ? 'answers.countTasks' : 'answers.countParts', { n: data?.total ?? 0 }, data?.total ?? 0) }}
      </p>

      <div
        v-if="data?.items.length"
        class="grid sm:grid-cols-2 gap-3"
        data-testid="answers-hub"
      >
        <NuxtLink
          v-for="i in data.items"
          :key="i.slug"
          :to="`${base}/${i.slug}`"
          class="group flex gap-4 rounded-xl ring ring-default bg-default p-4 transition-colors hover:ring-primary/40 hover:bg-primary/[0.02]"
        >
          <img
            :src="SKILL_ART[kind]"
            alt=""
            class="size-10 shrink-0"
          >
          <div class="min-w-0 flex-1">
            <p class="text-xs text-muted">
              {{ label(i) }}
            </p>
            <p class="font-semibold text-highlighted group-hover:text-primary line-clamp-2">
              {{ i.title }}
            </p>
            <p
              v-if="i.preview"
              class="text-sm text-muted mt-1 line-clamp-2"
            >
              {{ i.preview }}
            </p>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <UBadge
                v-if="i.questions"
                :label="t('answers.answersFor', { n: i.questions }, i.questions)"
                color="neutral"
                variant="soft"
                size="sm"
              />
              <UBadge
                v-if="i.samples"
                :label="t('answers.samples', { n: i.samples }, i.samples)"
                color="success"
                variant="soft"
                size="sm"
              />
            </div>
          </div>
        </NuxtLink>
      </div>
      <UEmpty
        v-else-if="status !== 'pending'"
        :icon="SKILL_META[kind].icon"
        :title="t('answers.none')"
      />

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
