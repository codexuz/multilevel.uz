<script setup lang="ts">
const route = useRoute()
const config = useRuntimeConfig()

const siteName = 'Multilevel'
const title = 'Multilevel - English Exam Prep'
const description = 'Free Multilevel (CEFR) English practice tests: Listening, Reading, Writing and Speaking. Check your answers instantly, with or without an account.'
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
    { name: 'theme-color', content: '#007aff' }
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
  </UApp>
</template>
