<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

provide(PANEL_LAYOUT, 'admin')

const { live } = useLiveMock()

const navItems = computed<NavigationMenuItem[]>(() => [
  { label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/admin' },
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
    badge: live.value ? { label: 'Live', color: 'error' as const, variant: 'subtle' as const, size: 'sm' as const } : undefined
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
</script>

<template>
  <PanelShell
    kind="admin"
    panel-label="Admin"
    home-to="/admin"
    :nav-items="navItems"
  >
    <slot />
  </PanelShell>
</template>
