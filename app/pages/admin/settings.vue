<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })
useSeoMeta({ title: 'Settings · Admin', robots: 'noindex' })

const route = useRoute()
const toast = useToast()
const { data: tg, refresh: refreshTg } = await useFetch<Record<string, any>>('/api/admin/telegram', { lazy: true })
const runningTask = ref<string | null>(null)

onMounted(() => {
  const g = route.query.google
  if (g === 'connected') toast.add({ title: 'Google Calendar connected for all online classes', color: 'success' })
  else if (g === 'scope') toast.add({ title: 'Calendar permission was not granted', color: 'warning' })
  else if (g === 'cancelled') toast.add({ title: 'Google sign-in was cancelled or denied (add this admin email to Google Cloud OAuth Test users)', color: 'warning' })
  else if (g === 'failed') toast.add({ title: 'Google connection failed — verify this admin email is listed in Google Cloud OAuth Test users', color: 'error' })
})

async function runTask(name: string) {
  runningTask.value = name
  try {
    await $fetch(`/api/admin/tasks/${encodeURIComponent(name)}`, { method: 'POST' })
    toast.add({ title: `Task "${name}" executed`, color: 'success' })
  } catch (e) {
    toast.add({ title: 'Task failed', description: errorMessage(e), color: 'error' })
  } finally {
    runningTask.value = null
  }
}

async function fixWebhook() {
  try {
    await $fetch('/api/admin/telegram', { query: { fix: '1' } })
    await refreshTg()
    toast.add({ title: 'Telegram webhook refreshed', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Could not refresh webhook', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Platform Settings"
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
            Google Meet (Shared Admin Account)
          </h3>
          <p class="text-xs text-muted mt-1">
            Only an admin connects Google Calendar here. All teachers automatically create Google Meet links through this account without needing individual Google OAuth approval.
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
              Telegram Bot Webhook
            </h3>
            <UButton
              label="Sync Webhook"
              icon="i-lucide-refresh-cw"
              size="xs"
              variant="outline"
              @click="fixWebhook"
            />
          </div>
          <p class="text-xs text-muted">
            Checks where Telegram delivers bot updates and any recent delivery errors.
          </p>
          <pre class="text-xs bg-elevated rounded-xl p-3 overflow-x-auto max-h-60">{{ JSON.stringify(tg ?? { status: 'Loading...' }, null, 2) }}</pre>
        </UCard>

        <UCard :ui="{ body: 'p-5 flex flex-col gap-3' }">
          <h3 class="font-semibold text-highlighted flex items-center gap-2">
            <UIcon
              name="i-lucide-clock"
              class="size-5 text-primary"
            />
            Scheduled Background Jobs
          </h3>
          <p class="text-xs text-muted">
            Trigger Nitro scheduled maintenance &amp; notification tasks on demand.
          </p>
          <div class="flex flex-col gap-2">
            <div
              v-for="job in [
                { name: 'live:mocks', label: 'Live Mocks Announcer', desc: 'Opens live mocks and posts results to channels' },
                { name: 'reminders:plan', label: 'Exam Plan Reminders', desc: 'Daily study-plan countdown nudges' },
                { name: 'reminders:marking', label: 'Marking Queue Reminders', desc: 'Notifies teachers of pending scripts' },
                { name: 'lessons:remind', label: 'Online Class Reminders', desc: 'Reminds students about upcoming Google Meet sessions' }
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
                label="Run"
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
