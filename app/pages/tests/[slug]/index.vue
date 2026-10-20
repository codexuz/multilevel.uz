<script setup lang="ts">
definePageMeta({ guestLayout: true })
// A test's public page: what Google indexes for the test's title. Rendered on the server with the
// test's title and description, structured data, and a way into each section for anyone.
const route = useRoute()
const slug = String(route.params.slug)
const config = useRuntimeConfig()
const { loggedIn, isPremium } = useMe()

const { data: test, error } = await useFetch<any>(`/api/tests/${slug}`)
if (error.value || !test.value) throw createError({ statusCode: 404, statusMessage: 'Test not found', fatal: true })

const t = test.value
const skills = computed(() => t.sections.filter((s: any) => s.items > 0))
const minutes = (seconds?: number | null) => (seconds ? Math.round(seconds / 60) : null)
const summary = computed(() => skills.value.map((s: any) => SKILL_META[s.skill as keyof typeof SKILL_META].label).join(', '))
const description = t.description || `Free Multilevel (CEFR) practice test: ${summary.value}. Check your answers instantly, with or without an account.`
const siteUrl = String(config.public.siteUrl || 'https://multilevel.uz').replace(/\/$/, '')
const url = `${siteUrl}/tests/${t.slug}`

const partLine = (p: any) => p.kind === 'part'
  ? `Part ${p.partNumber}${p.title ? ` — ${p.title}` : ''} · ${p.questions} questions`
  : p.kind === 'task'
    ? `${writingTaskLabel(p.taskNumber)}${p.title ? ` — ${p.title.replace(/^Task [\d.]+\s*[—-]\s*/, '')}` : ''} · ${p.minWords}+ words`
    : `${speakingPartLabel(p.partNumber)}${p.title ? ` — ${p.title.replace(/^Part [\d.]+\s*[—-]\s*/, '')}` : ''}`

const howChecked: Record<string, string> = {
  LISTENING: 'Checked instantly, with the answer key and explanations.',
  READING: 'Checked instantly, with the answer key and explanations.',
  WRITING: 'Write it in the real format and download it as PDF or Word. Signed in, an examiner marks it.',
  SPEAKING: 'Record your answers and listen back. Signed in, an examiner marks them.'
}

useSeoMeta({
  title: t.title,
  description,
  ogTitle: t.title,
  ogDescription: description,
  ogUrl: url,
  ogType: 'article',
  twitterTitle: t.title,
  twitterDescription: description
})
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'Quiz',
        'name': t.title,
        'description': description,
        'url': url,
        'inLanguage': 'en',
        'educationalLevel': 'CEFR B1–C1',
        'assesses': 'English language proficiency (Multilevel)',
        'learningResourceType': 'Practice test',
        'isAccessibleForFree': t.access !== 'PREMIUM',
        'datePublished': t.publishedAt ?? undefined,
        'dateModified': t.updatedAt ?? undefined,
        'about': { '@type': 'Thing', 'name': 'Multilevel English exam' },
        'hasPart': skills.value.map((s: any) => ({
          '@type': 'Quiz',
          'name': `${t.title} — ${SKILL_META[s.skill as keyof typeof SKILL_META].label}`,
          'url': `${url}/${String(s.skill).toLowerCase()}`,
          'timeRequired': minutes(s.durationSeconds) ? `PT${minutes(s.durationSeconds)}M` : undefined
        }))
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Tests', 'item': `${siteUrl}/tests` },
          { '@type': 'ListItem', 'position': 2, 'name': t.title, 'item': url }
        ]
      }
    ])
  }]
})
</script>

<template>
  <AppPage
    :title="t.title"
    back="/tests"
  >
    <div class="flex flex-col gap-6 max-w-5xl">
      <!-- The test's tile, large: the same colours as in the list -->
      <div
        class="relative overflow-hidden rounded-xl bg-gradient-to-br p-5 sm:p-8 text-white"
        :class="tileGradient(t.slug)"
      >
        <div class="relative z-1 flex flex-col gap-3 max-w-2xl">
          <div class="flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <span class="rounded-sm bg-white/20 px-1.5 py-0.5">Multilevel</span>
            <span
              v-if="t.access === 'PREMIUM'"
              class="rounded-sm bg-white/20 px-1.5 py-0.5 flex items-center gap-1"
            ><UIcon
              name="i-lucide-sparkles"
              class="size-3"
            />Premium</span>
            <span
              v-else
              class="rounded-sm bg-white/20 px-1.5 py-0.5"
            >Free</span>
            <span
              v-if="t.mode === 'MOCK'"
              class="rounded-sm bg-white/20 px-1.5 py-0.5"
            >Mock exam</span>
            <span
              v-if="t.category"
              class="rounded-sm bg-white/20 px-1.5 py-0.5"
            >{{ categoryLabel(t.category) }}</span>
          </div>
          <h1 class="text-2xl sm:text-4xl font-bold text-balance max-w-[85%] sm:max-w-none">
            {{ t.title }}
          </h1>
          <p class="text-white/85 text-pretty max-w-[85%] sm:max-w-xl">
            {{ description }}
          </p>
          <p
            v-if="t.source"
            class="text-xs text-white/70"
          >
            {{ t.source }}
          </p>
        </div>
        <img
          :src="tileArt(t.slug)"
          alt=""
          class="pointer-events-none absolute -bottom-4 -right-3 size-28 sm:size-44 drop-shadow-2xl"
          aria-hidden="true"
        >
      </div>

      <BillingPaywall
        v-if="t.access === 'PREMIUM' && !isPremium"
        reason="premium"
        compact
      />
      <UAlert
        v-else-if="!loggedIn"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        title="No account needed"
        description="Take any section now: your Listening and Reading are checked straight away. Sign in to keep your results and have Writing and Speaking marked by an examiner."
        :actions="[{ label: 'Sign in', to: `/login?next=${encodeURIComponent(route.fullPath)}`, color: 'info', variant: 'outline' }]"
      />

      <div class="grid sm:grid-cols-2 gap-4">
        <UCard
          v-for="s in skills"
          :key="s.skill"
          :ui="{ body: 'flex flex-col gap-3 h-full' }"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="size-10 shrink-0 rounded-xl bg-elevated grid place-items-center">
                <img
                  :src="SKILL_ART[s.skill]"
                  alt=""
                  class="size-6"
                >
              </div>
              <h2 class="font-semibold text-highlighted">
                {{ SKILL_META[s.skill as keyof typeof SKILL_META].label }}
              </h2>
            </div>
            <span class="text-sm text-muted">{{ minutes(s.durationSeconds) }} min{{ s.questions ? ` · ${s.questions} questions` : '' }}</span>
          </div>
          <ul class="text-sm text-toned flex flex-col gap-1">
            <li
              v-for="(p, i) in s.parts"
              :key="i"
              class="flex items-center justify-between gap-3"
            >
              <span class="min-w-0">{{ partLine(p) }}</span>
              <NuxtLink
                v-if="!(t.access === 'PREMIUM' && !isPremium) && (p.partNumber || p.taskNumber)"
                :to="`/tests/${t.slug}/${String(s.skill).toLowerCase()}?part=${p.partNumber ?? p.taskNumber}`"
                class="shrink-0 text-xs font-semibold text-primary hover:underline"
                :aria-label="`Practise ${partLine(p)} on its own`"
              >Practise</NuxtLink>
            </li>
          </ul>
          <p class="text-xs text-muted">
            {{ howChecked[s.skill] }}
          </p>
          <UButton
            v-if="t.access === 'PREMIUM' && !isPremium"
            class="mt-auto self-start"
            :to="`/pricing?from=${encodeURIComponent(route.fullPath)}`"
            label="Unlock with Premium"
            icon="i-lucide-lock-keyhole"
            color="neutral"
            variant="outline"
          />
          <UButton
            v-else
            class="mt-auto self-start"
            :to="`/tests/${t.slug}/${String(s.skill).toLowerCase()}`"
            :label="`Start ${SKILL_META[s.skill as keyof typeof SKILL_META].label}`"
            icon="i-lucide-play"
          />
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
