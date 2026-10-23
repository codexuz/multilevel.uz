<script setup lang="ts">
/**
 * A result someone shared: their card, and the way into the same test through their invite link
 * (so the friend starts with a credit and the sharer earns when the friend finishes a test).
 */
const { t } = useI18n()
definePageMeta({ layout: 'public' })

interface Shared { name: string, score: number, cefrLevel: string, skill: string, exam: string, band: number | null, partNumber: number | null, test: { slug: string, title: string } | null, code: string, image: string }

const route = useRoute()
const token = String(route.params.token)
const config = useRuntimeConfig()
const { data } = await useFetch<Shared>(`/api/share/${token}`)
if (!data.value) throw createError({ statusCode: 404, statusMessage: t('sharedPage.notAvailable'), fatal: true })

const d = data.value
const site = String(config.public.siteUrl || 'https://mockmee.uz').replace(/\/$/, '')
const skill = skillLabel(d.skill)
const level = d.cefrLevel === 'A2' ? t('common.belowB1') : d.cefrLevel
const ielts = d.band != null
const accent = ielts ? `${t('result.band')} ${fmtBand(d.band)}` : `${d.score}/75`
const k = (key: string) => `sharedPage.${key}${ielts ? 'Ielts' : ''}`
const title = t(k('title'), { name: d.name, score: ielts ? fmtBand(d.band) : d.score, level, skill })
const tryTo = `/r/${d.code}${d.test ? `?to=${encodeURIComponent(`/tests/${d.test.slug}`)}` : ''}`

useSeoMeta({
  title,
  description: t(k('description')),
  ogTitle: title,
  ogDescription: t(k('og')),
  ogImage: `${site}${d.image}`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  robots: 'noindex'
})
</script>

<template>
  <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center text-center gap-6">
    <img
      :src="d.image"
      :alt="title"
      width="1200"
      height="630"
      class="w-full rounded-xl shadow-xl ring ring-default"
    >
    <div class="flex flex-col gap-2">
      <h1 class="text-2xl sm:text-3xl font-bold text-highlighted text-balance">
        <i18n-t
          keypath="sharedPage.beat"
          scope="global"
        >
          <template #accent>
            <span class="text-accent">{{ accent }}</span>
          </template>
        </i18n-t>
      </h1>
      <p class="text-muted text-pretty max-w-lg">
        {{ d.test ? t(k('takeTest'), { title: d.test.title }) : t(k('takeAny')) }}
      </p>
    </div>
    <div class="grid gap-2 w-full sm:w-auto sm:flex">
      <UButton
        :to="tryTo"
        external
        size="xl"
        :label="d.test ? t('sharedPage.takeSkill', { skill }) : t('sharedPage.takeFree')"
        icon="i-lucide-play"
        class="justify-center"
      />
      <UButton
        :to="`/r/${d.code}`"
        external
        size="xl"
        color="neutral"
        variant="outline"
        :label="t('sharedPage.what')"
        class="justify-center"
      />
    </div>
  </div>
</template>
