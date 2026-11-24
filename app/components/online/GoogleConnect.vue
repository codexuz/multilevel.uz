<script setup lang="ts">
/**
 * The teacher's Google Calendar connection, which makes the Meet links of their online classes:
 * connected (as which account, with Disconnect), or the way to connect (back to `next`).
 */
const props = defineProps<{ next: string }>()
const emit = defineEmits<{ change: [connected: boolean] }>()
const { t } = useI18n()
const toast = useToast()
const { data, refresh } = await useFetch<{ available: boolean, connected: boolean, email: string | null }>('/api/google', { key: 'google-connection' })
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
      <p class="text-sm font-medium text-highlighted">
        {{ data.connected ? t('online.connectedAs', { email: data.email ?? 'Google' }) : t('online.connectTitle') }}
      </p>
      <p class="text-xs text-muted">
        {{ data.connected ? t('online.connectedText') : t('online.connectText') }}
      </p>
    </div>
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
  </div>
  <UAlert
    v-else-if="data"
    color="neutral"
    variant="subtle"
    icon="i-lucide-info"
    :title="t('online.notSetUp')"
  />
</template>
