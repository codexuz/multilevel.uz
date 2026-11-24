<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

export interface PanelNavChild {
  label: string
  to: string
  badge?: string
}

export interface PanelNavItem {
  label: string
  icon: string
  to?: string
  badge?: { label: string, color?: 'error' | 'primary' | 'success' | 'warning' | 'neutral' }
  children?: PanelNavChild[]
}

const props = defineProps<{
  kind: 'admin' | 'teacher'
  panelLabel: string
  headerTitle: string
  headerSubtitle: string
  searchPlaceholder: string
  navItems: PanelNavItem[]
  notificationCount?: number
  notificationTo?: string
}>()

const emit = defineEmits<{ search: [query: string] }>()

const route = useRoute()
const router = useRouter()
const { me, isAdmin } = useMe()
const { t } = useI18n()
const { locale, languages, choose } = useLanguage()
const colorMode = useColorMode()

const mobileOpen = ref(false)
const searchText = ref('')
const openGroups = ref<Record<string, boolean>>({})

function isLinkActive(to?: string) {
  if (!to) return false
  const [path, queryStr] = to.split('?')
  if (queryStr) {
    if (route.path !== path) return false
    const params = new URLSearchParams(queryStr)
    for (const [k, v] of params.entries()) {
      if (String(route.query[k] ?? '') !== v) return false
    }
    return true
  }
  if (path === '/admin' || path === '/teacher') return route.path === path
  return route.path === path || route.path.startsWith(`${path}/`)
}

function isGroupActive(item: PanelNavItem) {
  return !!item.children?.some(c => isLinkActive(c.to))
}

watch(() => route.fullPath, () => {
  mobileOpen.value = false
  for (const item of props.navItems) {
    if (item.children && isGroupActive(item)) openGroups.value[item.label] = true
  }
}, { immediate: true })

function toggleGroup(label: string) {
  openGroups.value[label] = !openGroups.value[label]
}

function onSearchSubmit() {
  const q = searchText.value.trim()
  emit('search', q)
  if (!q) return
  if (props.kind === 'admin') router.push({ path: '/admin/users', query: { search: q } })
  else router.push({ path: '/teacher/students', query: { q } })
}

const displayName = computed(() => me.value?.name || accountHandle(me.value) || (props.kind === 'admin' ? 'Admin' : 'Teacher'))
const roleSubtitle = computed(() => (props.kind === 'admin' ? 'Admin' : me.value?.role === 'admin' ? 'Admin · Teacher' : 'Teacher'))

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  reloadNuxtApp({ path: '/' })
}

const userMenu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: displayName.value, avatar: { src: me.value?.avatarUrl ?? undefined, alt: displayName.value }, description: accountHandle(me.value) }],
  [
    ...(props.kind !== 'admin' && isAdmin.value ? [{ label: 'Admin Panel', icon: 'i-lucide-shield-check', to: '/admin' }] : []),
    ...(props.kind !== 'teacher' ? [{ label: 'Teacher Panel', icon: 'i-lucide-graduation-cap', to: '/teacher' }] : []),
    { label: 'Student View', icon: 'i-lucide-compass', to: '/tests' }
  ],
  [
    { label: t('nav.profile'), icon: 'i-lucide-user', to: '/profile' },
    { label: t('nav.settings'), icon: 'i-lucide-settings', to: '/settings' },
    {
      label: t('lang.label'),
      icon: 'i-lucide-languages',
      children: languages.value.map(l => ({ label: l.name, type: 'checkbox' as const, checked: locale.value === l.code, onUpdateChecked: () => choose(l.code) }))
    },
    {
      label: colorMode.value === 'dark' ? t('nav.lightMode') : t('nav.darkMode'),
      icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: (e: Event) => {
        e.preventDefault()
        colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
      }
    }
  ],
  [{ label: t('nav.logOut'), icon: 'i-lucide-log-out', color: 'error', onSelect: () => logout() }]
])
</script>

<template>
  <div class="min-h-screen flex bg-[#f4f6fb] dark:bg-[#0d0e16] text-default">
    <!-- Desktop Midnight-Navy Sidebar -->
    <aside class="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#151a34] text-slate-200 border-r border-white/5 sticky top-0 h-screen select-none">
      <!-- Brand -->
      <div class="px-5 pt-5 pb-4 flex items-center gap-3">
        <NuxtLink
          :to="kind === 'admin' ? '/admin' : '/teacher'"
          class="flex items-center gap-3 group"
        >
          <div class="size-10 rounded-xl bg-gradient-to-br from-[#3b72f6] to-[#6366f1] grid place-items-center shadow-lg shadow-indigo-500/30 shrink-0">
            <UIcon
              name="i-lucide-graduation-cap"
              class="size-5 text-white"
            />
          </div>
          <div class="min-w-0">
            <p class="font-bold text-white text-base leading-tight tracking-tight truncate">
              Mockmee
            </p>
            <p class="text-[11px] text-slate-400 leading-tight truncate">
              IELTS &amp; CEFR Platform
            </p>
          </div>
        </NuxtLink>
      </div>

      <!-- Panel Role Pill -->
      <div class="px-4 pb-3">
        <div class="flex items-center gap-2 rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2 text-xs font-medium text-slate-200">
          <UIcon
            :name="kind === 'admin' ? 'i-lucide-shield-check' : 'i-lucide-user-round-check'"
            class="size-4 text-indigo-300 shrink-0"
          />
          <span class="truncate">{{ panelLabel }}</span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto px-3 py-1 space-y-1">
        <template
          v-for="item in navItems"
          :key="item.label"
        >
          <!-- Group with children -->
          <div v-if="item.children?.length">
            <button
              type="button"
              class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all"
              :class="isGroupActive(item) ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'"
              @click="toggleGroup(item.label)"
            >
              <UIcon
                :name="item.icon"
                class="size-[18px] shrink-0 opacity-85"
              />
              <span class="flex-1 text-start truncate">{{ item.label }}</span>
              <UIcon
                name="i-lucide-chevron-down"
                class="size-4 transition-transform duration-200 opacity-70"
                :class="openGroups[item.label] ? 'rotate-180' : ''"
              />
            </button>
            <div
              v-if="openGroups[item.label]"
              class="mt-1 ms-4 ps-3 border-l border-white/10 space-y-0.5"
            >
              <NuxtLink
                v-for="child in item.children"
                :key="child.to"
                :to="child.to"
                class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors"
                :class="isLinkActive(child.to) ? 'bg-white/12 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'"
              >
                <span class="truncate">{{ child.label }}</span>
                <span
                  v-if="child.badge"
                  class="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-rose-500/20 text-rose-300"
                >{{ child.badge }}</span>
              </NuxtLink>
            </div>
          </div>

          <!-- Single link -->
          <NuxtLink
            v-else-if="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all"
            :class="isLinkActive(item.to)
              ? 'bg-gradient-to-r from-[#3b72f6] to-[#5b5ef0] text-white shadow-md shadow-blue-600/25'
              : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'"
          >
            <UIcon
              :name="item.icon"
              class="size-[18px] shrink-0"
              :class="isLinkActive(item.to) ? 'text-white' : 'opacity-80'"
            />
            <span class="flex-1 truncate">{{ item.label }}</span>
            <span
              v-if="item.badge"
              class="px-2 py-0.5 text-[11px] font-semibold rounded-md"
              :class="item.badge.color === 'error' ? 'bg-rose-500 text-white' : 'bg-white/15 text-white'"
            >
              {{ item.badge.label }}
            </span>
          </NuxtLink>
        </template>
      </nav>

      <!-- Bottom Workspace Switcher Card (inspired by Plan card in mockups) -->
      <div class="p-3.5 mt-auto">
        <div class="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.04] border border-white/10 p-3.5 flex flex-col gap-2.5">
          <div class="flex items-center gap-2.5">
            <div class="size-9 rounded-xl bg-amber-400/15 text-amber-300 grid place-items-center shrink-0">
              <UIcon
                name="i-lucide-sparkles"
                class="size-4"
              />
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold text-white truncate">
                LMS + Exam Suite
              </p>
              <p class="text-[11px] text-slate-400 truncate">
                {{ kind === 'admin' ? 'Administrator Workspace' : 'Instructor Workspace' }}
              </p>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <NuxtLink
              v-if="kind === 'admin'"
              to="/teacher"
              class="w-full py-1.5 px-3 rounded-xl text-xs font-semibold text-center bg-gradient-to-r from-[#4f46e5] to-[#6366f1] hover:opacity-95 text-white transition-opacity"
            >
              Teacher Panel
            </NuxtLink>
            <NuxtLink
              v-else-if="isAdmin"
              to="/admin"
              class="w-full py-1.5 px-3 rounded-xl text-xs font-semibold text-center bg-gradient-to-r from-[#4f46e5] to-[#6366f1] hover:opacity-95 text-white transition-opacity"
            >
              Admin Panel
            </NuxtLink>
            <NuxtLink
              to="/tests"
              class="w-full py-1.5 px-3 rounded-xl text-xs font-medium text-center bg-white/10 hover:bg-white/15 text-slate-200 transition-colors"
            >
              Switch to Student View
            </NuxtLink>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile Navigation Slideover -->
    <USlideover
      v-model:open="mobileOpen"
      side="left"
      :ui="{ content: 'max-w-72 bg-[#151a34] text-slate-200 border-r border-white/10' }"
    >
      <template #content>
        <div class="flex flex-col h-full p-4">
          <div class="flex items-center justify-between pb-4 border-b border-white/10">
            <div class="flex items-center gap-2.5">
              <div class="size-9 rounded-xl bg-gradient-to-br from-[#3b72f6] to-[#6366f1] grid place-items-center">
                <UIcon
                  name="i-lucide-graduation-cap"
                  class="size-5 text-white"
                />
              </div>
              <div>
                <p class="font-bold text-white text-sm">
                  Mockmee
                </p>
                <p class="text-[11px] text-slate-400">
                  {{ panelLabel }}
                </p>
              </div>
            </div>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              class="text-slate-300"
              @click="mobileOpen = false"
            />
          </div>

          <nav class="flex-1 overflow-y-auto py-3 space-y-1">
            <template
              v-for="item in navItems"
              :key="item.label"
            >
              <div v-if="item.children?.length">
                <p class="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  {{ item.label }}
                </p>
                <NuxtLink
                  v-for="child in item.children"
                  :key="child.to"
                  :to="child.to"
                  class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm"
                  :class="isLinkActive(child.to) ? 'bg-indigo-500 text-white font-medium' : 'text-slate-300 hover:bg-white/10'"
                >
                  <span class="truncate">{{ child.label }}</span>
                </NuxtLink>
              </div>
              <NuxtLink
                v-else-if="item.to"
                :to="item.to"
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                :class="isLinkActive(item.to) ? 'bg-gradient-to-r from-[#3b72f6] to-[#5b5ef0] text-white' : 'text-slate-300 hover:bg-white/10'"
              >
                <UIcon
                  :name="item.icon"
                  class="size-4"
                />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <span
                  v-if="item.badge"
                  class="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-rose-500 text-white"
                >{{ item.badge.label }}</span>
              </NuxtLink>
            </template>
          </nav>

          <div class="pt-3 border-t border-white/10 flex flex-col gap-1.5">
            <NuxtLink
              to="/tests"
              class="w-full py-2 px-3 rounded-xl text-xs font-medium text-center bg-white/10 text-white"
            >
              Student View
            </NuxtLink>
          </div>
        </div>
      </template>
    </USlideover>

    <!-- Main Column -->
    <div class="flex-1 min-w-0 flex flex-col">
      <!-- Crisp Top Header Bar -->
      <header class="sticky top-0 z-30 bg-white/95 dark:bg-[#14141d]/95 backdrop-blur border-b border-default px-4 sm:px-6 h-16 flex items-center gap-3">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="ghost"
          class="lg:hidden -ms-2"
          aria-label="Open menu"
          @click="mobileOpen = true"
        />

        <div class="min-w-0 me-auto">
          <h1 class="text-base sm:text-lg font-bold text-highlighted leading-tight truncate">
            {{ headerTitle }}
          </h1>
          <p class="hidden sm:block text-xs text-muted truncate">
            {{ headerSubtitle }}
          </p>
        </div>

        <!-- Global Search -->
        <form
          class="hidden md:block w-64 lg:w-72"
          @submit.prevent="onSearchSubmit"
        >
          <UInput
            v-model="searchText"
            icon="i-lucide-search"
            :placeholder="searchPlaceholder"
            size="sm"
            variant="outline"
            class="w-full"
          />
        </form>

        <!-- Notifications -->
        <UButton
          v-if="notificationTo"
          :to="notificationTo"
          icon="i-lucide-bell"
          color="neutral"
          variant="ghost"
          square
          class="relative"
          :aria-label="notificationCount ? `${notificationCount} pending` : 'Notifications'"
        >
          <span
            v-if="notificationCount"
            class="absolute top-1.5 right-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#14141d]"
          />
        </UButton>

        <!-- User Profile Dropdown -->
        <UDropdownMenu
          :items="userMenu"
          :content="{ align: 'end', collisionPadding: 12 }"
        >
          <button
            type="button"
            class="flex items-center gap-2.5 ps-1.5 pe-2.5 py-1 rounded-full hover:bg-elevated transition-colors"
          >
            <UAvatar
              :src="me?.avatarUrl ?? undefined"
              :alt="displayName"
              size="sm"
              class="ring-2 ring-indigo-500/20"
            />
            <div class="hidden sm:block text-start leading-tight">
              <p class="text-xs font-semibold text-highlighted max-w-28 truncate">
                {{ displayName }}
              </p>
              <p class="text-[11px] text-muted">
                {{ roleSubtitle }}
              </p>
            </div>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 text-muted hidden sm:block"
            />
          </button>
        </UDropdownMenu>
      </header>

      <!-- Page Body -->
      <main class="flex-1 min-w-0 p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
