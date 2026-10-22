<script setup lang="ts">
import type { DeviceSessionDto } from '~/types/models'

const { t } = useI18n()

useSeoMeta({ title: () => t('nav.settings'), robots: 'noindex' })
const { data: sessions, refresh } = await useFetch<DeviceSessionDto[]>('/api/auth/sessions')
const toast = useToast()
const { confirm } = useDialogs()
async function revoke(id: string) {
  if (!await confirm({ title: t('settings.signOutDevice'), confirmLabel: t('settings.signOut'), color: 'error' })) return
  await $fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' })
  toast.add({ title: t('settings.signedOut'), color: 'success' })
  await refresh()
}
</script>

<template>
  <AppPage
    :title="t('nav.settings')"
    icon="i-lucide-settings"
  >
    <div class="flex flex-col gap-4 max-w-2xl">
      <UCard :ui="{ body: 'flex items-center justify-between gap-3' }">
        <div>
          <p class="font-medium">
            {{ t('lang.label') }}
          </p>
          <p class="text-sm text-muted">
            {{ t('settings.languageText') }}
          </p>
        </div>
        <LanguageSwitcher />
      </UCard>
      <TelegramNotifySettings />
      <p class="text-muted">
        {{ t('settings.devices') }}
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
                  :label="t('settings.thisDevice')"
                />
              </p>
              <p class="text-xs text-muted">
                {{ s.ipAddress || t('settings.unknownIp') }} · {{ t('settings.lastActive', { when: localeDate(s.lastSeenAt, intlLocale()) }) }}
              </p>
            </div>
            <UButton
              v-if="!s.current"
              size="sm"
              color="error"
              variant="ghost"
              :label="t('settings.signOut')"
              @click="revoke(s.id)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </AppPage>
</template>
