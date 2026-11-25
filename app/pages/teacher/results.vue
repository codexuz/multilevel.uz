<script setup lang="ts">
/**
 * Results of all my students, or of one class (?class=, as a class page's "All results" opens it).
 * The same board shows on each class's page under Results.
 */
definePageMeta({ middleware: 'teacher', layout: 'teacher' })
const { t } = useI18n()
useSeoMeta({ title: () => t('panel.results'), robots: 'noindex' })
</script>

<template>
  <AppPage
    :title="t('panel.results')"
    icon="i-lucide-bar-chart-2"
  >
    <TeacherResultsBoard />
  </AppPage>
</template>
