<script setup lang="ts">
/**
 * The front page: what the site is, the newest tests (rendered on the server, so search engines read
 * them), and how a test is taken with or without an account.
 */
const { loggedIn, me } = useMe()

const { data } = await useFetch<{ items: any[] }>('/api/tests', { query: { limit: 6 } })

useSeoMeta({
  title: 'Free Multilevel English mock tests',
  description: 'Free online Multilevel (CEFR) English practice tests: Listening, Reading, Writing and Speaking in the official format, checked instantly with a score out of 75 and your CEFR level.',
  ogTitle: 'Free Multilevel English mock tests',
  ogDescription: 'Listening, Reading, Writing and Speaking in the official Multilevel format, checked instantly.'
})

const steps = [
  { icon: 'i-lucide-mouse-pointer-click', title: 'Pick a test', description: 'Every test is free and open — no account needed to start.' },
  { icon: 'i-lucide-timer', title: 'Sit it as on the day', description: 'Official timing and layout: 35 Listening and 35 Reading questions, three Writing tasks, four Speaking parts.' },
  { icon: 'i-lucide-circle-check', title: 'See your score', description: 'Listening and Reading are checked the moment you hand in, with every answer explained.' },
  { icon: 'i-lucide-user-check', title: 'Keep your progress', description: 'Sign in to save results and have an examiner mark your Writing and Speaking.' }
]
</script>

<template>
  <AppPage
    title="Home"
    icon="i-lucide-house"
  >
    <div class="flex flex-col gap-8 max-w-6xl">
      <UCard
        :ui="{ body: 'p-6 sm:p-8' }"
        class="bg-[radial-gradient(120%_120%_at_100%_0%,color-mix(in_oklab,var(--ui-primary)_10%,transparent),transparent_60%)]"
      >
        <div class="flex flex-col gap-4 max-w-2xl">
          <UBadge
            label="Free · CEFR Multilevel"
            color="primary"
            variant="subtle"
            class="self-start"
          />
          <h1 class="text-2xl sm:text-4xl font-semibold tracking-tight text-highlighted text-balance">
            {{ loggedIn && me?.name ? `Welcome back, ${me.name.split(' ')[0]}` : 'Multilevel English mock tests, free and online' }}
          </h1>
          <p class="text-muted sm:text-lg text-pretty">
            Practise Listening, Reading, Writing and Speaking in the official format. Your answers are checked whether you sign in or not — sign in to keep them.
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              to="/tests"
              label="Browse tests"
              icon="i-lucide-clipboard-list"
              size="lg"
            />
            <UButton
              v-if="loggedIn"
              to="/results"
              label="My results"
              icon="i-lucide-chart-column"
              size="lg"
              color="neutral"
              variant="outline"
            />
            <UButton
              v-else
              to="/login"
              label="Sign in"
              icon="i-lucide-log-in"
              size="lg"
              color="neutral"
              variant="outline"
            />
          </div>
        </div>
      </UCard>

      <section class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="text-xl font-semibold text-highlighted">
            Newest tests
          </h2>
          <UButton
            to="/tests"
            label="All tests"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
          />
        </div>
        <div
          v-if="data?.items?.length"
          class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <TestCard
            v-for="t in data.items"
            :key="t.id"
            :test="t"
          />
        </div>
        <UEmpty
          v-else
          icon="i-lucide-clipboard-list"
          title="Tests are on their way"
          description="Check back soon."
          variant="naked"
        />
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="text-xl font-semibold text-highlighted">
          How it works
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UCard
            v-for="(s, i) in steps"
            :key="s.title"
          >
            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="s.icon"
                  class="size-5 text-primary"
                />
                <span class="text-xs text-muted">Step {{ i + 1 }}</span>
              </div>
              <p class="font-semibold text-highlighted">
                {{ s.title }}
              </p>
              <p class="text-sm text-muted">
                {{ s.description }}
              </p>
            </div>
          </UCard>
        </div>
      </section>

      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UCard
          v-for="skill in (['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const)"
          :key="skill"
        >
          <div class="flex items-center gap-3">
            <UIcon
              :name="SKILL_META[skill].icon"
              class="size-6 text-primary"
            />
            <div>
              <p class="font-semibold text-highlighted">
                {{ SKILL_META[skill].label }}
              </p>
              <p class="text-xs text-muted">
                {{ { LISTENING: '6 parts · 35 questions · ~35 min', READING: '5 parts · 35 questions · 60 min', WRITING: '3 tasks · 60 min', SPEAKING: '4 parts · ~15 min' }[skill] }}
              </p>
            </div>
          </div>
        </UCard>
      </section>
    </div>
  </AppPage>
</template>
