import type { NavigationMenuItem } from '@nuxt/ui'

/** The staff pages this user may open: in the sidebar, and on Profile on a phone. */
export function useStaffNav() {
  const { isStaff, isAdmin } = useMe()
  return computed<NavigationMenuItem[]>(() => [
    ...(isAdmin.value ? [{ label: 'Test builder', icon: 'i-lucide-blocks', to: '/builder' }] : []),
    ...(isStaff.value ? [{ label: 'Marking', icon: 'i-lucide-pen-line', to: '/marking' }] : []),
    ...(isAdmin.value ? [{ label: 'Users', icon: 'i-lucide-users', to: '/admin/users' }] : []),
    ...(isAdmin.value ? [{ label: 'Orders', icon: 'i-lucide-receipt', to: '/admin/orders' }, { label: 'Plans', icon: 'i-lucide-tags', to: '/admin/plans' }] : []),
    ...(isStaff.value ? [{ label: 'Overview', icon: 'i-lucide-layout-dashboard', to: '/admin' }] : [])
  ])
}
