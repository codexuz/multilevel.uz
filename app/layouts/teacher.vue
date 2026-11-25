<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// The Teacher panel: a teacher's classes, online classes, courses, tests, results and students.
provide(PANEL_LAYOUT, 'teacher')
const { t } = useI18n()

const navItems = computed<NavigationMenuItem[]>(() => [
  { label: t('panel.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/teacher' },
  { label: t('panel.myClasses'), icon: 'i-lucide-users', to: '/classes' },
  { label: t('nav.online'), icon: 'i-lucide-video', to: '/teacher/classes' },
  { label: t('nav.courses'), icon: 'i-lucide-graduation-cap', to: '/teacher/courses' },
  { label: t('vocab.title'), icon: 'i-lucide-layers', to: '/teacher/vocabulary' },
  {
    label: t('panel.tests'),
    icon: 'i-lucide-clipboard-list',
    children: [
      { label: t('panel.testLibrary'), to: '/tests' },
      { label: t('panel.mockSessions'), to: '/mocks' },
      { label: t('panel.marking'), to: '/marking' }
    ]
  },
  { label: t('panel.results'), icon: 'i-lucide-chart-column', to: '/teacher/results' },
  { label: t('panel.students'), icon: 'i-lucide-user-round', to: '/teacher/students' },
  { label: t('panel.resources'), icon: 'i-lucide-folder-open', to: '/teacher/resources' }
])
</script>

<template>
  <PanelShell
    kind="teacher"
    :panel-label="t('panel.teacher')"
    home-to="/teacher"
    :nav-items="navItems"
  >
    <slot />
  </PanelShell>
</template>
