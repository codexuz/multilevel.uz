<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

const siteName = 'Multilevel'
const title = 'Multilevel - English Exam Prep'
const description = 'Practice CEFR/Multilevel English exams: Listening, Reading, Writing and Speaking with live speaking partners and instant scoring.'
const siteUrl = computed(() => String(config.public.siteUrl || 'https://multilevel.uz').replace(/\/$/, ''))
const canonicalUrl = computed(() => `${siteUrl.value}${route.path === '/' ? '/' : route.path}`)
const socialImage = computed(() => `${siteUrl.value}/logo.png`)

useHead(() => ({
  titleTemplate: (pageTitle?: string | null) => {
    if (!pageTitle || pageTitle === title) return title
    return `${pageTitle} | ${siteName}`
  },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#00A155' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/logo.png' },
    { rel: 'canonical', href: canonicalUrl.value }
  ],
  htmlAttrs: {
    lang: 'en'
  },
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': siteName,
        'url': siteUrl.value,
        'description': description
      })
    }
  ]
}))

useSeoMeta({
  title,
  description,
  ogType: 'website',
  ogSiteName: siteName,
  ogTitle: title,
  ogDescription: description,
  ogUrl: canonicalUrl,
  ogImage: socialImage,
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: socialImage,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ClientOnly>
      <SpeakingGlobalCaller />
    </ClientOnly>
    <ConfirmDialog />
  </UApp>
</template>
