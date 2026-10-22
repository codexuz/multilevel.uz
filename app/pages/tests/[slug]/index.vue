<script setup lang="ts">
definePageMeta({ guestLayout: true })
// A test's public page: what Google indexes for the test's title. Rendered on the server with the
// test's title and description, structured data, and a way into each section for anyone.
const route = useRoute()
const slug = String(route.params.slug)
const config = useRuntimeConfig()
const { loggedIn, canOpen, rewardCredits, me, refresh: refreshMe } = useMe()
const toast = useToast()
const { t: tr } = useI18n()

const { data: test, error } = await useFetch<any>(`/api/tests/${slug}`)
if (error.value || !test.value) throw createError({ statusCode: 404, statusMessage: 'Test not found', fatal: true })

const t = test.value
/** A premium test this user has not opened: no Premium, not unlocked with credits. */
const locked = computed(() => !canOpen(t))
const cost = computed(() => me.value?.unlockCost ?? 1)
const unlocking = ref(false)
async function unlock() {
  unlocking.value = true
  try {
    await $fetch(`/api/tests/${t.slug}/unlock`, { method: 'POST' })
    await refreshMe()
    toast.add({ title: tr('test.opened'), description: tr('test.openedText'), color: 'success' })
  } catch (e: any) {
    toast.add({ title: tr('test.notOpened'), description: e?.data?.message || tr('test.tryAgain'), color: 'error' })
  } finally {
    unlocking.value = false
  }
}
const skills = computed(() => t.sections.filter((s: any) => s.items > 0))
const minutes = (seconds?: number | null) => (seconds ? Math.round(seconds / 60) : null)
const summary = computed(() => skills.value.map((s: any) => skillLabel(s.skill)).join(', '))
const description = computed(() => t.description || tr('test.description', { skills: summary.value }))
const siteUrl = String(config.public.siteUrl || 'https://mockmee.uz').replace(/\/$/, '')
const url = `${siteUrl}/tests/${t.slug}`

const ielts = t.exam === 'IELTS'
const partLine = (p: any) => p.kind === 'part'
  ? `${tr('part.part', { n: p.partNumber })}${p.title ? ` — ${p.title}` : ''} · ${tr('common.questions', { n: p.questions }, p.questions)}`
  : p.kind === 'task'
    ? `${writingTaskLabel(p.taskNumber, t.exam)}${p.title ? ` — ${p.title.replace(/^Task [\d.]+\s*[—-]\s*/, '')}` : ''} · ${tr('test.minWords', { n: p.minWords })}`
    : `${speakingPartLabel(p.partNumber, t.exam)}${p.title ? ` — ${p.title.replace(/^Part [\d.]+\s*[—-]\s*/, '')}` : ''}`

// IELTS: how each section is marked, on bands.
const howChecked = (skill: string) => tr(ielts ? `test.howIelts.${skill}` : `test.how.${skill}`)
const creditsText = (n: number) => tr('test.credits', { n }, n)
/** Sitting a section needs sign-in: a guest goes to sign in first and comes back to it. */
const sitTo = (path: string) => (loggedIn.value ? path : `/login?next=${encodeURIComponent(path)}`)

useSeoMeta({
  title: t.title,
  description: () => description.value,
  ogTitle: t.title,
  ogDescription: () => description.value,
  ogUrl: url,
  ogType: 'article',
  twitterTitle: t.title,
  twitterDescription: () => description.value
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
        'description': description.value,
        'url': url,
        'inLanguage': 'en',
        'educationalLevel': ielts ? 'IELTS band 4–9' : 'CEFR B1–C1',
        'assesses': `English language proficiency (${examLabel(t.exam, t.module)})`,
        'learningResourceType': 'Practice test',
        'isAccessibleForFree': t.access !== 'PREMIUM',
        'datePublished': t.publishedAt ?? undefined,
        'dateModified': t.updatedAt ?? undefined,
        'about': { '@type': 'Thing', 'name': ielts ? 'IELTS' : 'Multilevel English exam' },
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
            <span class="rounded-sm bg-white/20 px-1.5 py-0.5">{{ examLabel(t.exam, t.module) }}</span>
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
            >{{ tr('common.free') }}</span>
            <span
              v-if="t.mode === 'MOCK'"
              class="rounded-sm bg-white/20 px-1.5 py-0.5"
            >{{ tr('tests.mockExam') }}</span>
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

      <UCard
        v-if="locked && loggedIn && rewardCredits >= cost"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-4' }"
      >
        <img
          src="/illustrations/locked.svg"
          alt=""
          class="size-12 shrink-0"
        >
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-highlighted">
            {{ tr('test.openWith', { credits: creditsText(cost) }) }}
          </p>
          <p class="text-sm text-muted">
            {{ tr('test.openWithText', { n: rewardCredits }) }}
          </p>
        </div>
        <UButton
          :label="tr('test.openFor', { credits: creditsText(cost) })"
          icon="i-lucide-lock-keyhole-open"
          :loading="unlocking"
          class="justify-center"
          @click="unlock"
        />
      </UCard>
      <BillingPaywall
        v-else-if="locked"
        reason="premium"
        compact
      />
      <!-- Sold in a pack: the pack opens it for good -->
      <UCard
        v-if="locked && t.packs?.length"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-4' }"
      >
        <UIcon
          name="i-lucide-package"
          class="size-10 shrink-0 text-primary"
        />
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-highlighted">
            {{ tr('packs.inPack', { pack: t.packs[0].title }) }}
          </p>
          <p class="text-sm text-muted">
            {{ tr('packs.inPackText', { price: fmtUzs(t.packs[0].priceUzs) }) }}
          </p>
        </div>
        <UButton
          :to="`/packs/${t.packs[0].slug}`"
          :label="tr('packs.seePack')"
          icon="i-lucide-package"
          color="neutral"
          variant="outline"
          class="justify-center"
        />
      </UCard>
      <UAlert
        v-else-if="!loggedIn"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="tr('test.noAccount')"
        :description="tr('test.noAccountText')"
        :actions="[{ label: tr('nav.signIn'), to: `/login?next=${encodeURIComponent(route.fullPath)}`, color: 'info', variant: 'outline' }]"
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
                {{ skillLabel(s.skill) }}
              </h2>
            </div>
            <span class="text-sm text-muted">{{ tr('common.minutes', { n: minutes(s.durationSeconds) }) }}{{ s.questions ? ` · ${tr('common.questions', { n: s.questions }, s.questions)}` : '' }}</span>
          </div>
          <ul class="text-sm text-toned flex flex-col gap-1">
            <li
              v-for="(p, i) in s.parts"
              :key="i"
              class="flex items-center justify-between gap-3"
            >
              <span class="min-w-0">{{ partLine(p) }}</span>
              <NuxtLink
                v-if="!locked && (p.partNumber || p.taskNumber)"
                :to="sitTo(`/tests/${t.slug}/${String(s.skill).toLowerCase()}?part=${p.partNumber ?? p.taskNumber}`)"
                class="shrink-0 text-xs font-semibold text-primary hover:underline"
                :aria-label="tr('test.practiseAlone', { part: partLine(p) })"
              >{{ tr('tests.practise') }}</NuxtLink>
            </li>
          </ul>
          <p class="text-xs text-muted">
            {{ howChecked(s.skill) }}
          </p>
          <UButton
            v-if="locked"
            class="mt-auto self-start"
            :to="loggedIn && rewardCredits >= cost ? undefined : `/pricing?from=${encodeURIComponent(route.fullPath)}`"
            :label="loggedIn && rewardCredits >= cost ? tr('test.openFor', { credits: creditsText(cost) }) : tr('test.unlockPremium')"
            :loading="unlocking"
            icon="i-lucide-lock-keyhole"
            color="neutral"
            variant="outline"
            @click="loggedIn && rewardCredits >= cost ? unlock() : undefined"
          />
          <UButton
            v-else
            class="mt-auto self-start"
            :to="sitTo(`/tests/${t.slug}/${String(s.skill).toLowerCase()}`)"
            :label="loggedIn ? tr('test.startSkill', { skill: skillLabel(s.skill) }) : tr('test.signInToStart', { skill: skillLabel(s.skill) })"
            :icon="loggedIn ? 'i-lucide-play' : 'i-lucide-log-in'"
          />
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
