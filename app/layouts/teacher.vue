<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

provide(PANEL_LAYOUT, 'teacher')

const navItems = computed<NavigationMenuItem[]>(() => [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/teacher' },
  { label: 'Groups', icon: 'i-lucide-users', to: '/classes' },
  { label: 'Classes', icon: 'i-lucide-calendar-clock', to: '/teacher/classes' },
  { label: 'Courses', icon: 'i-lucide-book-open', to: '/teacher/courses' },
  {
    label: 'Tests & Exams',
    icon: 'i-lucide-file-text',
    children: [
      { label: 'Mock Sessions', to: '/mocks' },
      { label: 'Marking Queue', to: '/marking' },
      { label: 'Exam Catalogue', to: '/tests' }
    ]
  },
  { label: 'Results', icon: 'i-lucide-bar-chart-2', to: '/teacher/results' },
  { label: 'Students', icon: 'i-lucide-user-round', to: '/teacher/students' },
  { label: 'Resources', icon: 'i-lucide-folder-open', to: '/teacher/resources' }
])
</script>

<template>
  <PanelShell
    kind="teacher"
    panel-label="Teacher"
    home-to="/teacher"
    :nav-items="navItems"
  >
    <slot />
  </PanelShell>
</template>
