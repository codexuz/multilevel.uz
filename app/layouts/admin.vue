<script setup lang="ts">
import type { PanelNavItem } from '~/components/panel/Shell.vue'

provide(PANEL_LAYOUT, 'admin')

const { live } = useLiveMock()
const route = useRoute()

const navItems = computed<PanelNavItem[]>(() => [
  { label: 'Dashboard', icon: 'i-lucide-home', to: '/admin' },
  { label: 'Users', icon: 'i-lucide-users', to: '/admin/users' },
  {
    label: 'Tests',
    icon: 'i-lucide-file-text',
    children: [
      { label: 'All Tests & Builder', to: '/builder' },
      { label: 'IELTS Tests', to: '/builder?exam=IELTS' },
      { label: 'CEFR Tests', to: '/builder?exam=MULTILEVEL' },
      { label: 'Marking Queue', to: '/marking' }
    ]
  },
  {
    label: 'Live Mock',
    icon: 'i-lucide-radio',
    to: '/admin/live',
    badge: live.value ? { label: 'Live', color: 'error' } : undefined
  },
  { label: 'Tariffs & Packs', icon: 'i-lucide-layers', to: '/admin/packs' },
  { label: 'Promo Codes', icon: 'i-lucide-ticket-percent', to: '/admin/promos' },
  { label: 'Courses (LMS)', icon: 'i-lucide-book-open', to: '/admin/courses' },
  {
    label: 'Reports',
    icon: 'i-lucide-bar-chart-3',
    children: [
      { label: 'Growth & Analytics', to: '/admin/growth' },
      { label: 'Exam Attempts', to: '/admin/attempts' },
      { label: 'Orders & Revenue', to: '/admin/orders' }
    ]
  },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/admin/settings' }
])

const headerMeta = computed(() => {
  const p = route.path
  if (p === '/admin') return { title: 'Admin Panel', subtitle: 'Manage users, tests, courses, tariffs and live mock exams' }
  if (p.startsWith('/admin/users')) return { title: 'Users Management', subtitle: 'Manage student, teacher and admin accounts, roles and access' }
  if (p.startsWith('/admin/courses') || p.startsWith('/courses/manage')) return { title: 'LMS Courses', subtitle: 'Manage courses, units, lessons, interactive exercises and content drip' }
  if (p.startsWith('/builder')) return { title: 'Test Builder', subtitle: 'Author IELTS & CEFR listening, reading, writing and speaking exams' }
  if (p.startsWith('/admin/live')) return { title: 'Live Mocks', subtitle: 'Schedule live mock windows, Telegram channels and leaderboards' }
  if (p.startsWith('/admin/packs')) return { title: 'Tariffs & Packs', subtitle: 'Configure exam bundles, pricing and unlocked parts' }
  if (p.startsWith('/admin/promos')) return { title: 'Promo Codes', subtitle: 'Create and monitor discount and promotional codes' }
  if (p.startsWith('/admin/orders')) return { title: 'Orders & Revenue', subtitle: 'Track payments, Click transactions and granted access' }
  if (p.startsWith('/admin/attempts')) return { title: 'Exam Attempts', subtitle: 'Inspect candidate attempts, scores and integrity reviews' }
  if (p.startsWith('/admin/growth')) return { title: 'Growth & Reports', subtitle: 'Track signups, active learners, retention and revenue' }
  if (p.startsWith('/marking')) return { title: 'Marking Queue', subtitle: 'Grade submitted Writing and Speaking exams with AI draft assistance' }
  if (p.startsWith('/admin/settings')) return { title: 'Platform Settings', subtitle: 'Telegram webhook, channels and background jobs' }
  return { title: 'Admin Panel', subtitle: 'Manage users, tests, tariffs and live mock exams' }
})
</script>

<template>
  <PanelShell
    kind="admin"
    panel-label="Admin Panel"
    :header-title="headerMeta.title"
    :header-subtitle="headerMeta.subtitle"
    search-placeholder="Search users, tests, courses..."
    :nav-items="navItems"
    notification-to="/marking"
  >
    <slot />
  </PanelShell>
</template>
