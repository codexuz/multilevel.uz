<script setup lang="ts">
/**
 * A result someone shared: their card, and the way into the same test through their invite link
 * (so the friend starts with a credit and the sharer earns when the friend finishes a test).
 */
definePageMeta({ layout: 'public' })

interface Shared { name: string, score: number, cefrLevel: string, skill: string, partNumber: number | null, test: { slug: string, title: string } | null, code: string, image: string }

const route = useRoute()
const token = String(route.params.token)
const config = useRuntimeConfig()
const { data } = await useFetch<Shared>(`/api/share/${token}`)
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'This shared result is not available', fatal: true })

const d = data.value
const site = String(config.public.siteUrl || 'https://multilevel.uz').replace(/\/$/, '')
const skill = d.skill.charAt(0) + d.skill.slice(1).toLowerCase()
const level = d.cefrLevel === 'A2' ? 'below B1' : d.cefrLevel
const title = `${d.name} scored ${d.score}/75 (${level}) in Multilevel ${skill}`
const tryTo = `/r/${d.code}${d.test ? `?to=${encodeURIComponent(`/tests/${d.test.slug}`)}` : ''}`

useSeoMeta({
  title,
  description: 'Free Multilevel (CEFR) English mock tests, checked instantly. Take the same test and see your score out of 75.',
  ogTitle: title,
  ogDescription: 'Can you beat it? Take the same Multilevel test free and get your score out of 75 straight away.',
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
        Can you beat <span class="text-accent">{{ d.score }}/75</span>?
      </h1>
      <p class="text-muted text-pretty max-w-lg">
        {{ d.test ? `Take ${d.test.title} free` : 'Take a Multilevel mock test free' }} and get your score out of 75 and your CEFR level the moment you finish. No account needed.
      </p>
    </div>
    <div class="grid gap-2 w-full sm:w-auto sm:flex">
      <UButton
        :to="tryTo"
        external
        size="xl"
        :label="d.test ? `Take the ${skill} test` : 'Take a free test'"
        icon="i-lucide-play"
        class="justify-center"
      />
      <UButton
        :to="`/r/${d.code}`"
        external
        size="xl"
        color="neutral"
        variant="outline"
        label="What is Multilevel.uz?"
        class="justify-center"
      />
    </div>
  </div>
</template>
