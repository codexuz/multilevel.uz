<script setup lang="ts">
import type { UserRole } from '~/types/exam'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const toast = useToast()

interface AdminUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: UserRole
  createdAt: string
  isPremium: boolean
}
const { data: usersList, refresh } = await useFetch<AdminUser[]>('/api/admin/users')

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
          class="flex flex-wrap items-center gap-4 p-4"
        >
          <UAvatar
            :src="p.avatarUrl || undefined"
            :alt="p.name || 'User'"
            size="md"
          />
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">
              {{ p.name || 'Unnamed user' }}
            </p>
            <p class="text-xs text-muted">
              {{ p.email }} · joined {{ new Date(p.createdAt).toLocaleDateString() }}
            </p>
          </div>

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
        </div>
      </div>
    </UCard>
  </div>
</template>
