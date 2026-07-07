<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Multilevel — English Exam Prep'
const description = 'Practice CEFR/Multilevel English exams: Listening, Reading, Writing and Speaking with live speaking partners and instant scoring.'

useSeoMeta({
  title,
  titleTemplate: (t?: string | null) => (t ? `${t} · Multilevel` : title),
  description,
  ogTitle: title,
  ogDescription: description,
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
  </UApp>
</template>
