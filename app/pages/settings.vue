<script setup lang="ts">
import type { DeviceSessionDto } from '~/types/models'

useSeoMeta({ title: 'Settings', robots: 'noindex' })
const { data: sessions, refresh } = await useFetch<DeviceSessionDto[]>('/api/auth/sessions')
const toast = useToast()
const { confirm } = useDialogs()
const { me, refresh: refreshMe } = useMe()

/** Telegram messages from the bot; only for an account with Telegram connected. */
const savingNotify = ref(false)
async function setTelegramNotify(on: boolean) {
  savingNotify.value = true
  try {
    await $fetch('/api/me/notifications', { method: 'PATCH', body: { telegram: on } })
    await refreshMe()
  } catch {
    toast.add({ title: 'Not saved', description: 'Please try again.', color: 'error' })
  } finally {
    savingNotify.value = false
  }
}

async function revoke(id: string) {
  if (!await confirm({ title: 'Sign out this device?', confirmLabel: 'Sign out', color: 'error' })) return
  await $fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' })
  toast.add({ title: 'Device signed out', color: 'success' })
  await refresh()
}
</script>

<template>
  <AppPage
    title="Settings"
    icon="i-lucide-settings"
  >
    <div class="flex flex-col gap-4 max-w-2xl">
      <UCard>
        <div class="flex items-start gap-4">
          <UIcon
            name="i-logos-telegram"
            class="size-6 shrink-0 mt-0.5"
          />
          <div class="flex-1 min-w-0">
            <p class="font-medium">
              Telegram messages
            </p>
            <p class="text-sm text-muted text-pretty">
              {{ me?.telegram ? 'When your Writing or Speaking is marked, your AI feedback is ready, or a friend you invited earns you credits.' : 'Connect Telegram on your Profile to get a message when your work is marked.' }}
            </p>
          </div>
          <USwitch
            :model-value="!!me?.telegram && !!me?.telegramNotify"
            :disabled="!me?.telegram"
            :loading="savingNotify"
            aria-label="Telegram messages"
            @update:model-value="setTelegramNotify"
          />
        </div>
      </UCard>
      <p class="text-muted">
        Devices signed in to your account.
      </p>
      <UCard :ui="{ body: 'p-0 sm:p-0' }">
        <div class="divide-y divide-default">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="flex items-center gap-4 p-4"
          >
            <UIcon
              name="i-lucide-monitor-smartphone"
              class="size-5 text-primary shrink-0"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium flex items-center gap-2">
                {{ s.deviceLabel || 'Unknown device' }}
                <UBadge
                  v-if="s.current"
                  color="success"
                  variant="subtle"
                  size="sm"
                  label="This device"
                />
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
    </div>
  </AppPage>
</template>
