<script setup lang="ts">
import type { DeviceSessionDto } from '~/types/models'

const { data: sessions, refresh } = await useFetch<DeviceSessionDto[]>('/api/auth/sessions')
const toast = useToast()
const { confirm } = useConfirm()

async function revoke(id: string) {
  if (!await confirm({ title: 'Sign out this device?', confirmLabel: 'Sign out', color: 'error' })) return
  await $fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' })
  toast.add({ title: 'Device signed out', color: 'success' })
  await refresh()
}
</script>

<template>
  <UContainer class="py-8 max-w-2xl space-y-6">
    <div>
      <h1 class="text-2xl font-bold">
        Settings
      </h1>
      <p class="text-muted">
        Devices signed in to your account.
      </p>
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <div v-for="s in sessions" :key="s.id" class="flex items-center gap-4 p-4">
          <UIcon name="i-lucide-monitor-smartphone" class="size-5 text-primary shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="font-medium flex items-center gap-2">
              {{ s.deviceLabel || 'Unknown device' }}
              <UBadge v-if="s.current" color="success" variant="subtle" size="sm" label="This device" />
            </p>
            <p class="text-xs text-muted">
              {{ s.ipAddress || 'unknown IP' }} · last active {{ new Date(s.lastSeenAt).toLocaleString() }}
            </p>
          </div>
          <UButton
            v-if="!s.current"
            size="sm"
            color="error"
            variant="ghost"
            label="Sign out"
            @click="revoke(s.id)"
          />
        </div>
      </div>
    </UCard>
  </UContainer>
</template>
