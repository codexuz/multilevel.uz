<script setup lang="ts">
import type { Paginated, UserRole } from '~/types/models'
import type { Pack, Plan } from '~/utils/billing'

/**
 * Users: roles, bans, and plans. A plan sold privately (on Telegram) is switched on here with
 * Grant, which records it as a paid order with the amount actually taken.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Users', robots: 'noindex' })

const toast = useToast()
const { confirm } = useDialogs()
const { me } = useMe()

interface AdminUser {
  id: string
  name: string | null
  email: string | null
  telegramUsername: string | null
  telegram: boolean
  avatarUrl: string | null
  role: UserRole
  banned: boolean
  /** Marks Writing and Speaking of students outside a centre. */
  marker: boolean
  createdAt: string
  premiumUntil: string | null
  /** Premium through a seat at a centre whose licence runs. */
  centrePremium: boolean
  credits: number
  rewardCredits: number
  aiBonusReviews: number
  /** Their own mock credits, for mock sessions they run as a teacher. */
  mockCredits: number
}
// ─── The list: searched, filtered, sorted and paged on the server; kept in the address ───
const route = useRoute()
const router = useRouter()
const str = (v: unknown, fallback = '') => (typeof v === 'string' && v ? v : fallback)
const filters = reactive({
  role: str(route.query.role, 'ALL'),
  plan: str(route.query.plan, 'ALL'),
  status: str(route.query.status, 'ALL'),
  extra: str(route.query.extra, 'ALL'),
  sort: str(route.query.sort, 'NEWEST')
})
const page = ref(Math.max(1, Number(route.query.page) || 1))
const pageSize = ref([20, 50, 100].includes(Number(route.query.size)) ? Number(route.query.size) : 20)
const search = ref(str(route.query.q))
const q = ref(search.value)
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => (q.value = v.trim()), 300)
})
watch([q, filters, pageSize], () => (page.value = 1))
const query = computed(() => ({
  q: q.value || undefined,
  role: filters.role === 'ALL' ? undefined : filters.role,
  plan: filters.plan === 'ALL' ? undefined : filters.plan,
  status: filters.status === 'ALL' ? undefined : filters.status,
  marker: filters.extra === 'MARKER' ? '1' : undefined,
  telegram: filters.extra === 'TELEGRAM' ? '1' : undefined,
  sort: filters.sort === 'NEWEST' ? undefined : filters.sort,
  page: page.value > 1 ? page.value : undefined,
  pageSize: pageSize.value
}))
watch(query, ({ marker, telegram, pageSize: size, ...rest }) => {
  router.replace({ query: { ...rest, extra: marker ? 'MARKER' : telegram ? 'TELEGRAM' : undefined, size: size === 20 ? undefined : size } })
})
const { data, refresh, status: loadState } = await useFetch<Paginated<AdminUser>>('/api/admin/users', { query })
const usersList = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const shownFrom = computed(() => (total.value ? (page.value - 1) * pageSize.value + 1 : 0))
const shownTo = computed(() => Math.min(total.value, page.value * pageSize.value))
const filtered = computed(() => !!q.value || filters.role !== 'ALL' || filters.plan !== 'ALL' || filters.status !== 'ALL' || filters.extra !== 'ALL')
function clearFilters() {
  Object.assign(filters, { role: 'ALL', plan: 'ALL', status: 'ALL', extra: 'ALL' })
  search.value = ''
  q.value = ''
}
const filterItems = {
  role: [{ label: 'All roles', value: 'ALL' }, { label: 'Students', value: 'student' }, { label: 'Teachers', value: 'teacher' }, { label: 'Centre owners', value: 'center_owner' }, { label: 'Admins', value: 'admin' }],
  plan: [{ label: 'Any plan', value: 'ALL' }, { label: 'Premium', value: 'PREMIUM' }, { label: 'Free', value: 'FREE' }],
  status: [{ label: 'Any status', value: 'ALL' }, { label: 'Active', value: 'ACTIVE' }, { label: 'Banned', value: 'BANNED' }],
  extra: [{ label: 'Everyone', value: 'ALL' }, { label: 'Markers', value: 'MARKER' }, { label: 'With Telegram', value: 'TELEGRAM' }],
  sort: [{ label: 'Newest first', value: 'NEWEST' }, { label: 'Oldest first', value: 'OLDEST' }, { label: 'Name A–Z', value: 'NAME' }],
  size: [20, 50, 100].map(n => ({ label: `${n} per page`, value: n }))
}

const ROLE_LABEL: Record<UserRole, string> = { student: 'Student', teacher: 'Teacher', center_owner: 'Centre owner', admin: 'Admin' }
const roles = (Object.keys(ROLE_LABEL) as UserRole[]).map(value => ({ label: ROLE_LABEL[value], value }))

function fail(e: unknown) {
  toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
}

// ─── Many at once: pick users on this page, then one action for them all (never yourself) ───
const selected = ref<string[]>([])
watch([page, q], () => (selected.value = []))
const selectable = computed(() => (usersList.value ?? []).filter(u => u.id !== me.value?.id).map(u => u.id))
const allPicked = computed(() => selectable.value.length > 0 && selectable.value.every(id => selected.value.includes(id)))
function pickAll(on: boolean) {
  selected.value = on ? [...selectable.value] : []
}
function pick(id: string, on: boolean) {
  selected.value = on ? [...new Set([...selected.value, id])] : selected.value.filter(x => x !== id)
}
const bulkRole = ref<UserRole | undefined>(undefined)
const bulkBusy = ref(false)
async function bulk(action: 'ROLE' | 'MARKER_ON' | 'MARKER_OFF' | 'BAN' | 'UNBAN' | 'DELETE', role?: UserRole) {
  const n = selected.value.length
  if (!n) return
  if ((action === 'DELETE' || action === 'BAN') && !await confirm({
    title: action === 'DELETE' ? `Delete ${n} user${n === 1 ? '' : 's'}?` : `Ban ${n} user${n === 1 ? '' : 's'}?`,
    description: action === 'DELETE' ? 'This permanently removes the accounts and all their attempts and results. This cannot be undone.' : 'They are signed out everywhere and cannot sign in until unbanned.',
    confirmLabel: action === 'DELETE' ? 'Delete' : 'Ban',
    color: 'error'
  })) return
  bulkBusy.value = true
  try {
    const res = await $fetch<{ updated: number }>('/api/admin/users/bulk', { method: 'POST', body: { ids: selected.value, action, role } })
    toast.add({ title: `${res.updated} user${res.updated === 1 ? '' : 's'} ${action === 'ROLE' ? `set to ${ROLE_LABEL[role!]}` : action === 'MARKER_ON' ? 'can mark now' : action === 'MARKER_OFF' ? 'no longer mark' : action === 'BAN' ? 'banned' : action === 'UNBAN' ? 'unbanned' : 'deleted'}`, color: 'success' })
    selected.value = []
    bulkRole.value = undefined
    await refresh()
  } catch (e) {
    fail(e)
  } finally {
    bulkBusy.value = false
  }
}

async function setRole(p: AdminUser, role: UserRole) {
  try {
    await $fetch(`/api/admin/users/${p.id}/role`, { method: 'PATCH', body: { role } })
    toast.add({ title: `Role updated to ${role}`, color: 'success' })
    await refresh()
  } catch (e) {
    fail(e)
  }
}

// A marker marks Writing and Speaking handed in by students outside a learning centre.
async function toggleMarker(p: AdminUser) {
  try {
    await $fetch(`/api/admin/users/${p.id}/marker`, { method: 'PATCH', body: { marker: !p.marker } })
    toast.add({ title: p.marker ? 'Marking switched off' : 'Marking switched on', color: 'success' })
    await refresh()
  } catch (e) {
    fail(e)
  }
}

async function toggleBan(p: AdminUser) {
  const banning = !p.banned
  if (banning && !await confirm({
    title: `Ban ${p.name || accountHandle(p)}?`,
    description: 'They will be signed out of all devices and blocked from using the app.',
    confirmLabel: 'Ban',
    color: 'error'
  })) return
  try {
    await $fetch(`/api/admin/users/${p.id}/ban`, { method: 'PATCH', body: { banned: banning } })
    toast.add({ title: banning ? 'User banned' : 'User unbanned', color: 'success' })
    await refresh()
  } catch (e) {
    fail(e)
  }
}

async function removeUser(p: AdminUser) {
  if (!await confirm({
    title: `Delete ${p.name || accountHandle(p)}?`,
    description: 'This permanently removes the account and all their attempts and results. This cannot be undone.',
    confirmLabel: 'Delete',
    color: 'error'
  })) return
  try {
    await $fetch(`/api/admin/users/${p.id}`, { method: 'DELETE' })
    toast.add({ title: 'User deleted', color: 'success' })
    await refresh()
  } catch (e) {
    fail(e)
  }
}

// ─── Plans sold privately ───
const { data: planData } = await useFetch<{ plans: Plan[] }>('/api/admin/plans')
// Test packs sold privately are granted the same way (their value is "pack:<address>").
const { data: packData } = await useFetch<Pack[]>('/api/admin/packs', { default: () => [] })
const planItems = computed(() => [
  ...(planData.value?.plans ?? []).map(p => ({ label: `${p.name} — ${fmtUzs(p.priceUzs)}${p.active ? '' : ' (off sale)'}`, value: p.code })),
  ...packData.value.map(p => ({ label: `Pack: ${p.title} — ${fmtUzs(p.priceUzs)}${p.active ? '' : ' (off sale)'}`, value: `pack:${p.slug}` }))
])
const granting = ref<AdminUser | null>(null)
const grant = reactive({ plan: '', amount: null as number | null, note: '' })
const grantSaving = ref(false)
function openGrant(p: AdminUser) {
  const first = planData.value?.plans.find(x => x.featured) ?? planData.value?.plans[0]
  Object.assign(grant, { plan: first?.code ?? '', amount: first?.priceUzs ?? null, note: '' })
  granting.value = p
}
watch(() => grant.plan, (code) => {
  const plan = planData.value?.plans.find(x => x.code === code) ?? packData.value.find(x => `pack:${x.slug}` === code)
  if (plan) grant.amount = plan.priceUzs
})
async function saveGrant() {
  if (!granting.value || !grant.plan) return
  grantSaving.value = true
  try {
    await $fetch(`/api/admin/users/${granting.value.id}/grant`, { method: 'POST', body: { ...(grant.plan.startsWith('pack:') ? { pack: grant.plan.slice(5) } : { plan: grant.plan }), amountUzs: grant.amount, note: grant.note } })
    toast.add({ title: 'Plan switched on', description: `${granting.value.name || accountHandle(granting.value)} has it now.`, color: 'success' })
    granting.value = null
    await refresh()
  } catch (e) {
    fail(e)
  } finally {
    grantSaving.value = false
  }
}
// ─── What they hold: given (plus) or taken back (minus), for support cases, giveaways and sales ───
const BALANCES = [
  { key: 'markingCredits', label: 'Marking credits', help: 'One has an examiner mark a Writing or Speaking.', icon: 'i-lucide-pen-line', of: (p: AdminUser) => p.credits },
  { key: 'testCredits', label: 'Test credits', help: 'One opens one Premium test for good.', icon: 'i-lucide-gift', of: (p: AdminUser) => p.rewardCredits },
  { key: 'aiReviews', label: 'Extra AI reviews', help: 'Used after their regular AI allowance runs out.', icon: 'i-lucide-sparkles', of: (p: AdminUser) => p.aiBonusReviews },
  { key: 'mockCredits', label: 'Mock credits', help: 'Their own mock sessions: one per candidate checked in.', icon: 'i-lucide-monitor-check', of: (p: AdminUser) => p.mockCredits }
] as const
type BalanceKey = typeof BALANCES[number]['key']
const holding = ref<AdminUser | null>(null)
const change = reactive<Record<BalanceKey, number> & { note: string }>({ markingCredits: 0, testCredits: 0, aiReviews: 0, mockCredits: 0, note: '' })
const changed = computed(() => BALANCES.some(b => change[b.key]))
const balanceSaving = ref(false)
function openBalances(p: AdminUser) {
  Object.assign(change, { markingCredits: 0, testCredits: 0, aiReviews: 0, mockCredits: 0, note: '' })
  holding.value = p
}
async function saveBalances() {
  if (!holding.value || !changed.value) return
  balanceSaving.value = true
  try {
    await $fetch(`/api/admin/users/${holding.value.id}/balances`, { method: 'POST', body: { ...change } })
    toast.add({ title: 'Saved', description: `${holding.value.name || accountHandle(holding.value)} is told in Telegram of what was given (if connected).`, color: 'success' })
    holding.value = null
    await refresh()
  } catch (e) {
    fail(e)
  } finally {
    balanceSaving.value = false
  }
}

async function endPremium(p: AdminUser) {
  if (!await confirm({ title: `End Premium for ${p.name || accountHandle(p)}?`, description: 'Premium stops now. Their orders and marking credits stay.', confirmLabel: 'End Premium', color: 'error' })) return
  try {
    await $fetch(`/api/admin/users/${p.id}/premium`, { method: 'DELETE' })
    toast.add({ title: 'Premium ended', color: 'success' })
    await refresh()
  } catch (e) {
    fail(e)
  }
}
</script>

<template>
  <AppPage
    title="Users"
    icon="i-lucide-users"
  >
    <template #toolbar>
      <UDashboardToolbar :ui="{ root: 'flex-wrap gap-2 py-2 h-auto min-h-(--ui-header-height)' }">
        <div
          class="flex flex-wrap items-center gap-2 w-full"
          data-testid="user-filters"
        >
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Name, email or @username"
            class="w-full sm:w-64"
          />
          <USelect
            v-model="filters.role"
            :items="filterItems.role"
            class="w-36"
          />
          <USelect
            v-model="filters.plan"
            :items="filterItems.plan"
            class="w-32"
          />
          <USelect
            v-model="filters.status"
            :items="filterItems.status"
            class="w-32"
          />
          <USelect
            v-model="filters.extra"
            :items="filterItems.extra"
            class="w-36"
          />
          <USelect
            v-model="filters.sort"
            :items="filterItems.sort"
            icon="i-lucide-arrow-down-up"
            class="w-40"
          />
          <UButton
            v-if="filtered"
            label="Clear"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            @click="clearFilters"
          />
        </div>
      </UDashboardToolbar>
    </template>

    <UCard :ui="{ body: 'p-0 sm:p-0', header: 'px-4 py-2.5 sm:px-4' }">
      <!-- Bulk: what is picked, and one action for them all -->
      <template #header>
        <div
          class="flex flex-wrap items-center gap-2 min-h-8"
          data-testid="bulk-bar"
        >
          <UCheckbox
            :model-value="allPicked ? true : selected.length ? 'indeterminate' : false"
            :label="selected.length ? `${selected.length} selected` : 'Select all on this page'"
            @update:model-value="v => pickAll(!!v)"
          />
          <template v-if="selected.length">
            <USelect
              v-model="bulkRole"
              :items="roles"
              placeholder="Set role…"
              size="sm"
              class="w-36 ms-2"
              @update:model-value="v => v && bulk('ROLE', v as UserRole)"
            />
            <UDropdownMenu
              :items="[[
                { label: 'Switch marking on', icon: 'i-lucide-pen-line', onSelect: () => bulk('MARKER_ON') },
                { label: 'Switch marking off', icon: 'i-lucide-pen-off', onSelect: () => bulk('MARKER_OFF') }
              ]]"
            >
              <UButton
                label="Marking"
                icon="i-lucide-pen-line"
                trailing-icon="i-lucide-chevron-down"
                size="sm"
                color="neutral"
                variant="outline"
                :loading="bulkBusy"
                data-testid="bulk-marker"
              />
            </UDropdownMenu>
            <UButton
              label="Ban"
              icon="i-lucide-ban"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="bulkBusy"
              @click="bulk('BAN')"
            />
            <UButton
              label="Unban"
              icon="i-lucide-circle-check"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="bulkBusy"
              @click="bulk('UNBAN')"
            />
            <UButton
              label="Delete"
              icon="i-lucide-trash-2"
              size="sm"
              color="error"
              variant="soft"
              :loading="bulkBusy"
              data-testid="bulk-delete"
              @click="bulk('DELETE')"
            />
            <UButton
              label="Clear"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="selected = []"
            />
          </template>
        </div>
      </template>
      <div class="divide-y divide-default">
        <div
          v-for="p in usersList"
          :key="p.id"
          class="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:gap-4"
          :class="selected.includes(p.id) ? 'bg-primary/5' : ''"
          data-testid="user-row"
        >
          <div class="flex items-center gap-3 min-w-0 lg:flex-1">
            <UCheckbox
              :model-value="selected.includes(p.id)"
              :disabled="p.id === me?.id"
              :aria-label="`Select ${p.name || accountHandle(p)}`"
              @update:model-value="v => pick(p.id, !!v)"
            />
            <UAvatar
              :src="p.avatarUrl || undefined"
              :alt="p.name || 'User'"
              size="md"
              class="shrink-0"
            />
            <div class="min-w-0">
              <p class="font-medium truncate flex items-center gap-2">
                {{ p.name || 'Unnamed user' }}
                <UBadge
                  v-if="p.marker"
                  color="primary"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-pen-line"
                  label="Marker"
                />
                <UBadge
                  v-if="p.banned"
                  color="error"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-ban"
                  label="Banned"
                />
              </p>
              <p class="text-xs text-muted truncate">
                <UIcon
                  v-if="p.telegram"
                  name="i-logos-telegram"
                  class="size-3 align-[-1px] me-0.5"
                  aria-label="Telegram"
                />{{ accountHandle(p) }} · joined {{ localeDate(p.createdAt, 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
              </p>
              <p class="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span :class="p.premiumUntil || p.centrePremium ? 'text-success' : 'text-muted'">
                  <UIcon
                    name="i-lucide-sparkles"
                    class="size-3 align-[-1px]"
                  />
                  {{ p.premiumUntil ? `Premium until ${formatDate(p.premiumUntil)}` : p.centrePremium ? 'Premium (centre)' : 'Free' }}
                </span>
                <span class="text-muted tabular-nums"><UIcon
                  name="i-lucide-pen-line"
                  class="size-3 align-[-1px]"
                /> {{ creditsText(p.credits) }}</span>
                <span
                  v-if="p.rewardCredits"
                  class="text-muted tabular-nums"
                ><UIcon
                  name="i-lucide-gift"
                  class="size-3 align-[-1px]"
                /> {{ p.rewardCredits }} test {{ p.rewardCredits === 1 ? 'credit' : 'credits' }}</span>
                <span
                  v-if="p.aiBonusReviews"
                  class="text-muted tabular-nums"
                ><UIcon
                  name="i-lucide-sparkles"
                  class="size-3 align-[-1px]"
                /> +{{ p.aiBonusReviews }} AI</span>
                <span
                  v-if="p.mockCredits"
                  class="text-muted tabular-nums"
                ><UIcon
                  name="i-lucide-monitor-check"
                  class="size-3 align-[-1px]"
                /> {{ p.mockCredits }} mock</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 lg:shrink-0">
            <USelect
              :model-value="p.role"
              :items="roles"
              class="w-32 sm:w-36"
              @update:model-value="setRole(p, $event as UserRole)"
            />
            <UButton
              size="sm"
              icon="i-lucide-gift"
              label="Grant"
              color="primary"
              variant="soft"
              @click="openGrant(p)"
            />
            <UButton
              size="sm"
              icon="i-lucide-coins"
              color="neutral"
              variant="outline"
              aria-label="Balances"
              data-testid="balances"
              @click="openBalances(p)"
            >
              <span class="hidden sm:inline">Balances</span>
            </UButton>
            <UDropdownMenu
              :items="[[
                { label: 'Attempts', icon: 'i-lucide-clipboard-check', to: `/admin/attempts?user=${p.id}` },
                { label: p.marker ? 'Switch marking off' : 'Switch marking on', icon: p.marker ? 'i-lucide-pen-off' : 'i-lucide-pen-line', onSelect: () => toggleMarker(p) },
                ...(p.premiumUntil ? [{ label: 'End Premium', icon: 'i-lucide-circle-stop', onSelect: () => endPremium(p) }] : []),
                ...(p.id !== me?.id ? [
                  { label: p.banned ? 'Unban' : 'Ban', icon: p.banned ? 'i-lucide-circle-check' : 'i-lucide-ban', onSelect: () => toggleBan(p) },
                  { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => removeUser(p) }
                ] : [])
              ]]"
            >
              <UButton
                icon="i-lucide-ellipsis"
                color="neutral"
                variant="ghost"
                size="sm"
                square
                aria-label="More"
              />
            </UDropdownMenu>
          </div>
        </div>
        <div
          v-if="!usersList.length && loadState !== 'pending'"
          class="p-8"
        >
          <UEmpty
            icon="i-lucide-users"
            title="No users found"
            :description="filtered ? 'Nobody matches these filters.' : undefined"
            :actions="filtered ? [{ label: 'Clear filters', icon: 'i-lucide-x', color: 'neutral', variant: 'outline', onClick: clearFilters }] : []"
            variant="naked"
          />
        </div>
      </div>
    </UCard>

    <div
      v-if="total"
      class="flex flex-wrap items-center justify-between gap-3"
      data-testid="users-pager"
    >
      <p class="text-sm text-muted tabular-nums">
        {{ shownFrom }}–{{ shownTo }} of {{ total }}
      </p>
      <UPagination
        v-if="total > pageSize"
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
        show-edges
        :sibling-count="1"
      />
      <USelect
        v-model="pageSize"
        :items="filterItems.size"
        size="sm"
        class="w-32"
      />
    </div>

    <UModal
      :open="!!granting"
      title="Grant a plan"
      :description="granting ? `For ${granting.name || accountHandle(granting)} — e.g. sold on Telegram.` : ''"
      @update:open="v => !v && (granting = null)"
    >
      <template #body>
        <div class="grid gap-4">
          <UFormField
            label="Plan"
            required
          >
            <USelect
              v-model="grant.plan"
              :items="planItems"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Amount received (so'm)"
            help="Recorded on the order; leave the price if they paid it in full."
          >
            <UInputNumber
              v-model="grant.amount"
              :min="0"
              :step="1000"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Note"
            help="How they paid, the Telegram chat — anything to find it again."
          >
            <UInput
              v-model="grant.note"
              placeholder="Paid by card transfer, @username"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            block
            class="sm:w-auto"
            @click="granting = null"
          />
          <UButton
            label="Switch on"
            icon="i-lucide-check"
            :loading="grantSaving"
            :disabled="!grant.plan"
            block
            class="sm:w-auto"
            @click="saveGrant"
          />
        </div>
      </template>
    </UModal>
    <UModal
      :open="!!holding"
      title="Balances"
      :description="holding ? `What ${holding.name || accountHandle(holding)} holds. A plus gives, a minus takes back; nothing goes below zero.` : ''"
      @update:open="v => !v && (holding = null)"
    >
      <template #body>
        <form
          v-if="holding"
          class="grid gap-3"
          data-testid="balances-form"
          @submit.prevent="saveBalances"
        >
          <div
            v-for="b in BALANCES"
            :key="b.key"
            class="flex items-center gap-3 rounded-lg ring ring-default p-3"
          >
            <UIcon
              :name="b.icon"
              class="size-5 shrink-0 text-primary"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-highlighted">
                {{ b.label }}
              </p>
              <p class="text-xs text-muted">
                {{ b.help }}
              </p>
            </div>
            <div class="text-end text-sm tabular-nums w-20 shrink-0">
              <p class="text-muted">
                {{ b.of(holding) }}<template v-if="change[b.key]">
                  → <span :class="b.of(holding) + change[b.key] < 0 ? 'text-error' : 'text-highlighted font-semibold'">{{ b.of(holding) + change[b.key] }}</span>
                </template>
              </p>
            </div>
            <UInputNumber
              v-model="change[b.key]"
              :min="-b.of(holding)"
              :max="10000"
              class="w-32 shrink-0"
              :data-testid="`balance-${b.key}`"
            />
          </div>
          <UFormField
            label="Note"
            help="Kept with mock credits: how they paid, the Telegram chat."
          >
            <UInput
              v-model="change.note"
              placeholder="Paid 500 000 so'm on Telegram"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="holding = null"
            />
            <UButton
              type="submit"
              label="Save"
              :loading="balanceSaving"
              :disabled="!changed"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
