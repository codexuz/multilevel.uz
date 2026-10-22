<script setup lang="ts">
/**
 * Every account's attempts, newest first: found by the candidate, skill or status, or for one
 * account (?user=<id>, from Users). Each opens the result and its review, as the candidate sees it.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Attempts', robots: 'noindex' })

interface AdminAttempt {
  id: string
  skill: string
  partNumber: number | null
  status: string
  test: { id: string, slug: string, title: string } | null
  user?: { id: string, name: string, avatarUrl: string | null }
  contact: { email: string | null, telegramUsername: string | null, telegram: boolean } | null
  submittedAt: string
  correct: number | null
  total: number | null
  score: number | null
  band?: number | null
  exam?: string
  cefrLevel: string | null
  liveMockId: string | null
}

const route = useRoute()
const router = useRouter()
const page = ref(1)
const search = ref('')
const q = ref('')
const skill = ref('ALL')
const status = ref('ALL')
const user = computed(() => (typeof route.query.user === 'string' ? route.query.user : undefined))
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    q.value = v.trim()
    page.value = 1
  }, 300)
})
watch([skill, status, user], () => (page.value = 1))

const { data, status: loadState } = await useFetch<{ items: AdminAttempt[], total: number, pages: number, user: { id: string, name: string } | null }>('/api/admin/attempts', {
  query: {
    page, limit: 20, user,
    q: computed(() => q.value || undefined),
    skill: computed(() => (skill.value === 'ALL' ? undefined : skill.value)),
    status: computed(() => (status.value === 'ALL' ? undefined : status.value))
  },
  lazy: true
})

const skillItems = [{ label: 'Every skill', value: 'ALL' }, ...(['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const).map(s => ({ label: skillLabel(s), value: s }))]
const statusItems = [{ label: 'Any status', value: 'ALL' }, { label: 'Marked', value: 'GRADED' }, { label: 'With the examiner', value: 'SUBMITTED' }]
const clearUser = () => router.replace({ query: {} })
</script>

<template>
  <AppPage
    title="Attempts"
    icon="i-lucide-clipboard-check"
  >
    <template #toolbar>
      <UDashboardToolbar>
        <div class="flex flex-wrap items-center gap-2 py-1.5">
          <UInput
            v-if="!user"
            v-model="search"
            icon="i-lucide-search"
            placeholder="Candidate: name, email or @username"
            class="w-full sm:w-72"
          />
          <USelect
            v-model="skill"
            :items="skillItems"
            class="w-40"
          />
          <USelect
            v-model="status"
            :items="statusItems"
            class="w-44"
          />
        </div>
      </UDashboardToolbar>
    </template>

    <div
      v-if="user"
      class="flex items-center justify-between gap-3 rounded-xl bg-primary/8 px-4 py-3"
    >
      <p class="text-sm">
        Attempts of <span class="font-semibold text-highlighted">{{ data?.user?.name ?? 'this account' }}</span>
        <span class="text-muted"> · {{ data?.total ?? 0 }} in all</span>
      </p>
      <UButton
        label="Everyone"
        icon="i-lucide-x"
        size="sm"
        color="neutral"
        variant="ghost"
        @click="clearUser"
      />
    </div>
    <p
      v-else
      class="text-sm text-muted"
    >
      {{ data?.total ?? 0 }} attempts
    </p>

    <div class="rounded-xl ring ring-default bg-default divide-y divide-default overflow-hidden">
      <NuxtLink
        v-for="a in data?.items ?? []"
        :key="a.id"
        :to="`/results/${a.id}`"
        class="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-muted transition-colors"
      >
        <div class="size-10 shrink-0 rounded-xl bg-elevated grid place-items-center">
          <img
            :src="SKILL_ART[a.skill]"
            alt=""
            class="size-6"
          >
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-highlighted truncate">
            {{ a.user?.name ?? 'Deleted account' }}
            <span
              v-if="accountHandle(a.contact) && accountHandle(a.contact) !== a.user?.name"
              class="text-xs font-normal text-muted"
            > · {{ accountHandle(a.contact) }}</span>
          </p>
          <p class="text-xs text-muted truncate">
            {{ a.test?.title || 'Removed test' }} · {{ a.exam === 'IELTS' ? 'IELTS ' : '' }}{{ skillLabel(a.skill) }}{{ a.partNumber ? ` ${partName(a.skill, a.partNumber, a.exam)}` : '' }}
            <span v-if="a.total"> · {{ a.correct }}/{{ a.total }}</span>
            <span v-if="a.liveMockId"> · Live mock</span>
          </p>
        </div>
        <span class="text-xs text-muted tabular-nums shrink-0 max-md:hidden">{{ formatDate(a.submittedAt, true) }}</span>
        <div
          v-if="hasResult(a)"
          class="w-16 text-right shrink-0"
        >
          <p class="font-bold text-highlighted tabular-nums leading-none">
            {{ fmtResult(a) }}<span class="text-xs font-medium text-muted">{{ a.band != null ? '' : '/75' }}</span>
          </p>
          <UBadge
            :label="resultLevel(a) === 'A2' ? 'Below B1' : resultLevel(a)!"
            :color="resultColor(a)"
            variant="soft"
            size="sm"
            class="mt-1"
          />
        </div>
        <UBadge
          v-else
          label="Examiner"
          color="warning"
          variant="soft"
          size="sm"
          class="shrink-0"
        />
        <UIcon
          name="i-lucide-chevron-right"
          class="size-4 text-dimmed shrink-0 max-sm:hidden"
        />
      </NuxtLink>
      <UEmpty
        v-if="loadState !== 'pending' && !data?.items?.length"
        icon="i-lucide-clipboard-check"
        title="No attempts"
        description="Nothing matches these filters."
        variant="naked"
        class="py-10"
      />
    </div>

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
