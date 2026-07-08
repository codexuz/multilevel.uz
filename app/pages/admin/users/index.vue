<script setup lang="ts">
import type { UserRole } from '~/types/exam'
import type { Paginated } from '~/types/models'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const toast = useToast()
const { confirm } = useConfirm()
const { me } = useMe()

interface AdminUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: UserRole
  banned: boolean
  createdAt: string
  isPremium: boolean
}
const page = ref(1)
const { data, refresh } = await useFetch<Paginated<AdminUser>>('/api/admin/users', { query: { page } })
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

async function grantPremium(p: AdminUser, days = 30) {
  try {
    await $fetch(`/api/admin/users/${p.id}/subscription`, { method: 'POST', body: { days } })
    toast.add({ title: `Premium granted for ${days} days`, color: 'success' })
    await refresh()
  } catch (e) {
    fail(e)
  }
}

async function revokePremium(p: AdminUser) {
  try {
    await $fetch(`/api/admin/users/${p.id}/subscription`, { method: 'DELETE' })
    toast.add({ title: 'Premium revoked', color: 'success' })
    await refresh()
  } catch (e) {
    fail(e)
  }
}

async function toggleBan(p: AdminUser) {
  const banning = !p.banned
  if (banning && !await confirm({
    title: `Ban ${p.name || p.email}?`,
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
    title: `Delete ${p.name || p.email}?`,
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
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      Users
    </h1>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <div
          v-for="p in usersList"
          :key="p.id"
          class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
        >
          <!-- User identity -->
          <div class="flex items-center gap-3 min-w-0 sm:flex-1">
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
                {{ p.email }} · joined {{ new Date(p.createdAt).toLocaleDateString() }}
              </p>
            </div>
          </div>

          <!-- Controls -->
          <div class="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0">
            <USelect
              :model-value="p.role"
              :items="roles"
              class="w-32"
              @update:model-value="setRole(p, $event as UserRole)"
            />

            <UBadge
              v-if="p.isPremium"
              color="primary"
              variant="subtle"
              icon="i-lucide-sparkles"
              label="Premium"
            />
            <UButton
              v-if="p.isPremium"
              size="sm"
              color="error"
              variant="ghost"
              label="Revoke"
              @click="revokePremium(p)"
            />
            <UButton
              v-else
              size="sm"
              color="primary"
              variant="soft"
              icon="i-lucide-sparkles"
              label="Grant 30d"
              @click="grantPremium(p, 30)"
            />

            <!-- Ban / delete (never on your own account) -->
            <template v-if="p.id !== me?.id">
              <UButton
                size="sm"
                :color="p.banned ? 'success' : 'warning'"
                variant="ghost"
                :icon="p.banned ? 'i-lucide-circle-check' : 'i-lucide-ban'"
                :label="p.banned ? 'Unban' : 'Ban'"
                @click="toggleBan(p)"
              />
              <UButton
                size="sm"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="removeUser(p)"
              />
            </template>
          </div>
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
  </div>
</template>
