<script setup lang="ts">
import type { Paginated, UserRole } from '~/types/models'
import type { Plan } from '~/utils/billing'

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
  createdAt: string
  premiumUntil: string | null
  credits: number
}
const page = ref(1)
const search = ref('')
const q = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (v) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    q.value = v.trim()
    page.value = 1
  }, 300)
})
const { data, refresh } = await useFetch<Paginated<AdminUser>>('/api/admin/users', { query: { page, q } })
const usersList = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const pageSize = computed(() => data.value?.pageSize ?? 20)

const roles: UserRole[] = ['student', 'examiner', 'admin']

function fail(e: unknown) {
  toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
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
const planItems = computed(() => (planData.value?.plans ?? []).map(p => ({ label: `${p.name} — ${fmtUzs(p.priceUzs)}${p.active ? '' : ' (off sale)'}`, value: p.code })))
const granting = ref<AdminUser | null>(null)
const grant = reactive({ plan: '', amount: null as number | null, note: '' })
const grantSaving = ref(false)
function openGrant(p: AdminUser) {
  const first = planData.value?.plans.find(x => x.featured) ?? planData.value?.plans[0]
  Object.assign(grant, { plan: first?.code ?? '', amount: first?.priceUzs ?? null, note: '' })
  granting.value = p
}
watch(() => grant.plan, (code) => {
  const plan = planData.value?.plans.find(x => x.code === code)
  if (plan) grant.amount = plan.priceUzs
})
async function saveGrant() {
  if (!granting.value || !grant.plan) return
  grantSaving.value = true
  try {
    await $fetch(`/api/admin/users/${granting.value.id}/grant`, { method: 'POST', body: { plan: grant.plan, amountUzs: grant.amount, note: grant.note } })
    toast.add({ title: 'Plan switched on', description: `${granting.value.name || accountHandle(granting.value)} has it now.`, color: 'success' })
    granting.value = null
    await refresh()
  } catch (e) {
    fail(e)
  } finally {
    grantSaving.value = false
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
      <UDashboardToolbar>
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Name, email or @username"
          class="w-full sm:w-72"
        />
      </UDashboardToolbar>
    </template>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <div
          v-for="p in usersList"
          :key="p.id"
          class="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:gap-4"
        >
          <div class="flex items-center gap-3 min-w-0 lg:flex-1">
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
                />{{ accountHandle(p) }} · joined {{ new Date(p.createdAt).toLocaleDateString() }}
              </p>
              <p class="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span :class="p.premiumUntil ? 'text-success' : 'text-muted'">
                  <UIcon
                    name="i-lucide-sparkles"
                    class="size-3 align-[-1px]"
                  />
                  {{ p.premiumUntil ? `Premium until ${formatDate(p.premiumUntil)}` : 'Free' }}
                </span>
                <span class="text-muted tabular-nums"><UIcon
                  name="i-lucide-pen-line"
                  class="size-3 align-[-1px]"
                /> {{ creditsText(p.credits) }}</span>
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 lg:shrink-0">
            <USelect
              :model-value="p.role"
              :items="roles"
              class="w-32"
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
            <UDropdownMenu
              :items="[[
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
          v-if="!usersList.length"
          class="p-8"
        >
          <UEmpty
            icon="i-lucide-users"
            title="No users found"
            variant="naked"
          />
        </div>
      </div>
    </UCard>

    <div
      v-if="total > pageSize"
      class="flex justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="pageSize"
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
  </AppPage>
</template>
