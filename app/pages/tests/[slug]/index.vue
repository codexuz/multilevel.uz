<script setup lang="ts">
// A test's public page: what Google indexes for the test's title. Rendered on the server with the
// test's title and description, structured data, and a way into each section for anyone.
const route = useRoute()
const slug = String(route.params.slug)
const config = useRuntimeConfig()
const { loggedIn } = useMe()

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
        'isAccessibleForFree': true,
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
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl font-semibold text-highlighted">
          {{ t.title }}
        </h1>
        <p class="text-muted">
          {{ description }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <UBadge
            label="Multilevel"
            color="primary"
            variant="subtle"
          />
          <UBadge
            v-if="t.mode === 'MOCK'"
            label="Mock format"
            color="warning"
            variant="subtle"
          />
          <UBadge
            v-if="t.category"
            :label="categoryLabel(t.category)"
            color="neutral"
            variant="outline"
          />
          <UBadge
            v-if="t.source"
            :label="t.source"
            color="neutral"
            variant="outline"
          />
        </div>
      </div>

      <UAlert
        v-if="!loggedIn"
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
              <UIcon
                :name="SKILL_META[s.skill as keyof typeof SKILL_META].icon"
                class="size-5 text-primary"
              />
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
            >
              {{ partLine(p) }}
            </li>
          </ul>
          <p class="text-xs text-muted">
            {{ howChecked[s.skill] }}
          </p>
          <UButton
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
