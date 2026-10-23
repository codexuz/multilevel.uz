import type { NavigationMenuItem } from '@nuxt/ui'

/** The staff pages this user may open: in the sidebar, and on Profile on a phone. */
export function useStaffNav() {
  const { isStaff, isAdmin } = useMe()
  const { t } = useI18n()
  return computed<NavigationMenuItem[]>(() => [
    ...(isAdmin.value ? [{ label: t('nav.staffBuilder'), icon: 'i-lucide-blocks', to: '/builder' }] : []),
    ...(isStaff.value ? [{ label: t('nav.staffMarking'), icon: 'i-lucide-pen-line', to: '/marking' }] : []),
    ...(isAdmin.value ? [{ label: t('nav.staffUsers'), icon: 'i-lucide-users', to: '/admin/users' }, { label: t('nav.staffAttempts'), icon: 'i-lucide-clipboard-check', to: '/admin/attempts' }] : []),
    ...(isAdmin.value ? [{ label: t('nav.staffOrders'), icon: 'i-lucide-receipt', to: '/admin/orders' }, { label: t('nav.staffPlans'), icon: 'i-lucide-tags', to: '/admin/plans' }, { label: t('nav.staffPacks'), icon: 'i-lucide-package', to: '/admin/packs' }, { label: t('nav.staffPromos'), icon: 'i-lucide-ticket-percent', to: '/admin/promos' }, { label: t('nav.staffLive'), icon: 'i-lucide-trophy', to: '/admin/live' }, { label: t('nav.staffIntegrity'), icon: 'i-lucide-shield-alert', to: '/admin/integrity' }, { label: t('nav.staffGrowth'), icon: 'i-lucide-trending-up', to: '/admin/growth' }, { label: t('nav.staffCentres'), icon: 'i-lucide-school', to: '/admin/centres' }] : []),
    ...(isStaff.value ? [{ label: t('nav.staffOverview'), icon: 'i-lucide-layout-dashboard', to: '/admin' }] : [])
  ])
}
