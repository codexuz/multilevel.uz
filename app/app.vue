<script setup lang="ts">
import { en, ru, uz } from '@nuxt/ui/locale'

const route = useRoute()
const config = useRuntimeConfig()
const { t, locale } = useI18n()
const uiLocale = computed(() => ({ en, uz, ru }[locale.value as 'en' | 'uz' | 'ru'] ?? en))

const siteName = 'Multilevel'
const title = computed(() => t('site.title'))
const description = computed(() => t('site.description'))
const siteUrl = computed(() => String(config.public.siteUrl || 'https://multilevel.uz').replace(/\/$/, ''))
const canonicalUrl = computed(() => `${siteUrl.value}${route.path === '/' ? '/' : route.path}`)
const socialImage = computed(() => `${siteUrl.value}/logo.png`)

useHead(() => ({
  titleTemplate: (pageTitle?: string | null) => {
    if (!pageTitle || pageTitle === title.value) return title.value
    return `${pageTitle} | ${siteName}`
  },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'theme-color', content: '#636eee' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/site.webmanifest' },
    { rel: 'canonical', href: canonicalUrl.value }
  ],
  htmlAttrs: {
    lang: locale.value
  },
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': siteName,
        'url': siteUrl.value,
        'description': description.value
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
  <UApp :locale="uiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
