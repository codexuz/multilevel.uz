<script setup lang="ts">
import type { Paged } from '~/types/ielts'

// The open catalog, rendered on the server so every title and description is in the page Google reads.
const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const page = ref(Number(route.query.page) || 1)
const debounced = ref(search.value)
let timer: ReturnType<typeof setTimeout> | undefined
watch(search, (q) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    debounced.value = q.trim()
    page.value = 1
  }, 300)
})
watch([debounced, page], ([q, p]) => router.replace({ query: { ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) } }))

const { data: tests, status } = await useFetch<Paged<any>>('/api/tests', { query: computed(() => ({ search: debounced.value || undefined, page: page.value, limit: 12 })) })

useSeoMeta({
  title: 'Free Multilevel practice tests',
  description: 'Free Multilevel (CEFR) English practice tests with instant checking: Listening, Reading, Writing and Speaking papers in the real exam format.'
})
</script>

<template>
  <AppPage
    title="Tests"
    icon="i-lucide-clipboard-list"
  >
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          Multilevel <span class="text-accent">practice tests</span>
        </h1>
        <p class="text-muted mt-1">
          Every test is free. Listening and Reading are checked the moment you finish; sign in to keep your results.
        </p>
      </div>
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search tests"
        class="w-full sm:w-80"
        aria-label="Search tests"
      />

      <div
        v-if="status === 'pending' && !tests"
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <USkeleton
          v-for="i in 6"
          :key="i"
          class="h-48"
        />
      </div>
      <UEmpty
        v-else-if="!tests?.items.length"
        icon="i-lucide-files"
        :title="search ? 'No tests match your search' : 'No tests yet'"
        :description="search ? 'Try other words.' : 'New tests are published here.'"
      />
      <div
        v-else
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <TestCard
          v-for="t in tests.items"
          :key="t.id"
          :test="t"
        />
      </div>
      <UPagination
        v-if="(tests?.pages ?? 1) > 1"
        v-model:page="page"
        :total="tests!.total"
        :items-per-page="tests!.limit"
      />
    </div>
  </AppPage>
</template>
