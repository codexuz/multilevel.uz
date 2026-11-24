<script setup lang="ts">
import type { PanelNavItem } from '~/components/panel/Shell.vue'

provide(PANEL_LAYOUT, 'teacher')

const route = useRoute()

const navItems = computed<PanelNavItem[]>(() => [
  { label: 'Dashboard', icon: 'i-lucide-home', to: '/teacher' },
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

const headerMeta = computed(() => {
  const p = route.path
  if (p === '/teacher') return { title: 'Teacher Dashboard', subtitle: 'Manage your groups, classes, courses and students\' progress' }
  if (p.startsWith('/classes')) return { title: 'My Groups', subtitle: 'Manage student groups, join codes and exam assignments' }
  if (p.startsWith('/teacher/classes')) return { title: 'Online Classes', subtitle: 'Schedule and launch Google Meet sessions for your groups and courses' }
  if (p.startsWith('/teacher/courses') || p.startsWith('/courses/manage')) return { title: 'LMS Course Studio', subtitle: 'Build structured courses with units, lessons, interactive exercises and content drip' }
  if (p.startsWith('/mocks')) return { title: 'Mock Sessions', subtitle: 'Run proctored classroom IELTS & CEFR mock sessions with seat codes' }
  if (p.startsWith('/marking')) return { title: 'Marking Queue', subtitle: 'Evaluate your students\' Writing and Speaking submissions' }
  if (p.startsWith('/teacher/results')) return { title: 'Student Results', subtitle: 'Review exam scores and LMS exercise performance across your classes' }
  if (p.startsWith('/teacher/students')) return { title: 'My Students', subtitle: 'Track every learner across your groups and courses' }
  if (p.startsWith('/teacher/resources')) return { title: 'Resources', subtitle: 'Handouts, PDFs, videos and audio across your courses' }
  return { title: 'Teacher Dashboard', subtitle: 'Manage your groups, classes, courses and students\' progress' }
})
</script>

<template>
  <PanelShell
    kind="teacher"
    panel-label="Teacher Panel"
    :header-title="headerMeta.title"
    :header-subtitle="headerMeta.subtitle"
    search-placeholder="Search students, groups, tests..."
    :nav-items="navItems"
    notification-to="/marking"
  >
    <slot />
  </PanelShell>
</template>
