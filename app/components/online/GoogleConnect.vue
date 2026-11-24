<script setup lang="ts">
/**
 * Shared platform Google Calendar status (connected once by an Admin in Admin Settings).
 * - Admins see Connect / Disconnect controls.
 * - Teachers see read-only readiness status (never asked to authorize their own Google account).
 */
const props = defineProps<{ next: string }>()
const emit = defineEmits<{ change: [connected: boolean] }>()
const { t } = useI18n()
const toast = useToast()
const { data, refresh } = await useFetch<{ available: boolean, connected: boolean, email: string | null, canManage: boolean }>('/api/google', { key: 'google-connection' })
watch(() => data.value?.connected, c => emit('change', !!c), { immediate: true })

const connectTo = computed(() => `/auth/google-calendar?next=${encodeURIComponent(props.next)}`)
const busy = ref(false)
async function disconnect() {
  if (!confirm(t('online.disconnectSure'))) return
  busy.value = true
  try {
    await $fetch('/api/google', { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    v-if="data?.available"
    class="flex flex-wrap items-center gap-3 rounded-lg ring ring-default p-3"
    data-testid="google-connect"
  >
    <UIcon
      name="i-logos-google-meet"
      class="size-6 shrink-0"
    />
    <div class="min-w-0 flex-1">
      <template v-if="data.canManage">
        <p class="text-sm font-medium text-highlighted">
          {{ data.connected ? t('online.connectedAs', { email: data.email ?? 'Google' }) : t('online.connectTitle') }}
        </p>
        <p class="text-xs text-muted">
          {{ data.connected ? t('online.adminConnectedText') : t('online.adminConnectText') }}
        </p>
      </template>
      <template v-else>
        <p class="text-sm font-medium text-highlighted">
          {{ data.connected ? t('online.ready') : t('online.notReady') }}
        </p>
        <p class="text-xs text-muted">
          {{ data.connected ? t('online.readyText') : t('online.notReadyText') }}
        </p>
      </template>
    </div>

    <template v-if="data.canManage">
      <UButton
        v-if="!data.connected"
        :href="connectTo"
        external
        :label="t('online.connect')"
        icon="i-simple-icons-google"
        size="sm"
        data-testid="google-connect-button"
      />
      <UButton
        v-else
        :label="t('online.disconnect')"
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="busy"
        @click="disconnect"
      />
    </template>
    <UBadge
      v-else
      :label="data.connected ? t('online.readyBadge') : t('online.adminSetup')"
      :color="data.connected ? 'success' : 'warning'"
      variant="subtle"
      size="sm"
    />
  </div>
  <UAlert
    v-else-if="data"
    color="neutral"
    variant="subtle"
    icon="i-lucide-info"
    :title="t('online.notSetUp')"
  />
</template>
