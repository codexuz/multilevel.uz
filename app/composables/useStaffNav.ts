import type { NavigationMenuItem } from '@nuxt/ui'

/** Separate workspace launchers shown on Profile (mobile) so Student View stays cleanly split from Admin & Teacher panels. */
export function useStaffNav() {
  const { me, isAdmin } = useMe()
  const isTeacher = computed(() => !!me.value && (me.value.role === 'teacher' || me.value.role === 'center_owner' || me.value.role === 'admin' || !!me.value.teaches || !!me.value.runsMocks))
  return computed<NavigationMenuItem[]>(() => [
    ...(isAdmin.value ? [{ label: 'Admin Panel', icon: 'i-lucide-shield-check', to: '/admin' }] : []),
    ...(isTeacher.value ? [{ label: 'Teacher Panel', icon: 'i-lucide-school', to: '/teacher' }] : [])
  ])
}
