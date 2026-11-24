<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
const { t } = useI18n()
useSeoMeta({ title: () => t('panel.platform'), robots: 'noindex' })

const route = useRoute()
const toast = useToast()
const { data: tg, refresh: refreshTg } = await useFetch<Record<string, any>>('/api/admin/telegram', { lazy: true })
const runningTask = ref<string | null>(null)

onMounted(() => {
  const g = route.query.google
  if (g === 'connected') toast.add({ title: t('asettings.gConnected'), color: 'success' })
  else if (g === 'scope') toast.add({ title: t('asettings.gScope'), color: 'warning' })
  else if (g === 'cancelled') toast.add({ title: t('asettings.gCancelled'), color: 'warning' })
  else if (g === 'failed') toast.add({ title: t('asettings.gFailed'), color: 'error' })
})

async function runTask(name: string) {
  runningTask.value = name
  try {
    await $fetch(`/api/admin/tasks/${encodeURIComponent(name)}`, { method: 'POST' })
    toast.add({ title: t('asettings.taskDone', { name }), color: 'success' })
  } catch (e) {
    toast.add({ title: t('asettings.taskFailed'), description: errorMessage(e), color: 'error' })
  } finally {
    runningTask.value = null
  }
}

async function fixWebhook() {
  try {
    await $fetch('/api/admin/telegram', { query: { fix: '1' } })
    await refreshTg()
    toast.add({ title: t('asettings.webhookDone'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    :title="t('panel.platform')"
    icon="i-lucide-settings"
  >
    <div class="flex flex-col gap-5">
      <!-- Shared Admin Google Calendar / Google Meet Setup -->
      <UCard :ui="{ body: 'p-5 flex flex-col gap-3' }">
        <div>
          <h3 class="font-semibold text-highlighted flex items-center gap-2">
            <UIcon
              name="i-logos-google-meet"
              class="size-5"
            />
            {{ t('asettings.meetTitle') }}
          </h3>
          <p class="text-xs text-muted mt-1">
            {{ t('asettings.meetText') }}
          </p>
        </div>
        <OnlineGoogleConnect next="/admin/settings" />
      </UCard>

      <div class="grid md:grid-cols-2 gap-5">
        <UCard :ui="{ body: 'p-5 flex flex-col gap-3' }">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-highlighted flex items-center gap-2">
              <UIcon
                name="i-simple-icons-telegram"
                class="size-5 text-sky-500"
              />
              {{ t('asettings.webhookTitle') }}
            </h3>
            <UButton
              :label="t('asettings.sync')"
              icon="i-lucide-refresh-cw"
              size="xs"
              variant="outline"
              @click="fixWebhook"
            />
          </div>
          <p class="text-xs text-muted">
            {{ t('asettings.webhookText') }}
          </p>
          <pre class="text-xs bg-elevated rounded-xl p-3 overflow-x-auto max-h-60">{{ JSON.stringify(tg ?? { status: '…' }, null, 2) }}</pre>
        </UCard>

        <UCard :ui="{ body: 'p-5 flex flex-col gap-3' }">
          <h3 class="font-semibold text-highlighted flex items-center gap-2">
            <UIcon
              name="i-lucide-clock"
              class="size-5 text-primary"
            />
            {{ t('asettings.jobsTitle') }}
          </h3>
          <p class="text-xs text-muted">
            {{ t('asettings.jobsText') }}
          </p>
          <div class="flex flex-col gap-2">
            <div
              v-for="job in [
                { name: 'live:mocks', label: t('asettings.job.liveMocks'), desc: t('asettings.job.liveMocksText') },
                { name: 'reminders:plan', label: t('asettings.job.plan'), desc: t('asettings.job.planText') },
                { name: 'reminders:marking', label: t('asettings.job.marking'), desc: t('asettings.job.markingText') },
                { name: 'lessons:remind', label: t('asettings.job.lessons'), desc: t('asettings.job.lessonsText') }
              ]"
              :key="job.name"
              class="flex items-center justify-between gap-3 rounded-xl ring ring-default px-3.5 py-2.5"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-highlighted">
                  {{ job.label }}
                </p>
                <p class="text-xs text-muted">
                  {{ job.desc }}
                </p>
              </div>
              <UButton
                :label="t('asettings.run')"
                size="xs"
                variant="soft"
                :loading="runningTask === job.name"
                @click="runTask(job.name)"
              />
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </AppPage>
</template>
