<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

provide(PANEL_LAYOUT, 'admin')
const { t } = useI18n()

const { live } = useLiveMock('ANY')

const navItems = computed<NavigationMenuItem[]>(() => [
  { label: t('panel.dashboard'), icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: t('panel.users'), icon: 'i-lucide-users', to: '/admin/users' },
  {
    label: t('panel.tests'),
    icon: 'i-lucide-clipboard-list',
    children: [
      { label: t('panel.allTests'), to: '/builder' },
      { label: 'IELTS', to: '/builder?exam=IELTS' },
      { label: 'Multilevel', to: '/builder?exam=MULTILEVEL' },
      { label: t('panel.marking'), to: '/marking' }
    ]
  },
  {
    label: t('nav.live'),
    icon: 'i-lucide-radio',
    to: '/admin/live',
    badge: live.value ? { label: t('nav.liveBadge'), color: 'error' as const, variant: 'subtle' as const, size: 'sm' as const } : undefined
  },
  { label: t('panel.broadcasts'), icon: 'i-lucide-megaphone', to: '/admin/broadcasts' },
  { label: t('panel.packs'), icon: 'i-lucide-layers', to: '/admin/packs' },
  { label: t('panel.promos'), icon: 'i-lucide-ticket-percent', to: '/admin/promos' },
  { label: t('nav.courses'), icon: 'i-lucide-graduation-cap', to: '/admin/courses' },
  {
    label: t('panel.reports'),
    icon: 'i-lucide-chart-column',
    children: [
      { label: t('panel.growth'), to: '/admin/growth' },
      { label: t('panel.attempts'), to: '/admin/attempts' },
      { label: t('panel.orders'), to: '/admin/orders' }
    ]
  },
  { label: t('panel.platform'), icon: 'i-lucide-sliders-horizontal', to: '/admin/settings' }
])
</script>

<template>
  <PanelShell
    kind="admin"
    :panel-label="t('panel.admin')"
    home-to="/admin"
    :nav-items="navItems"
  >
    <slot />
  </PanelShell>
</template>
