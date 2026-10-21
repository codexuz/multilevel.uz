<script setup lang="ts">
/**
 * Live mocks: pick a test and a window (a weekend, say). A draft test stays hidden until the window
 * opens and joins the library when it closes; the bot announces the start and sends each participant
 * their place at the end. Windows may not overlap.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Live mocks', robots: 'noindex' })

interface Mock {
  id: string
  title: string
  startsAt: string
  endsAt: string
  state: 'UPCOMING' | 'LIVE' | 'ENDED'
  announcedAt: string | null
  resultsSentAt: string | null
  participants: number
  test: { title: string | null, status: string | null }
}

const toast = useToast()
const { data: mocks, refresh } = await useFetch<Mock[]>('/api/admin/live', { default: () => [] })
const { data: testData } = await useFetch<{ items: { id: string, title: string, status: string }[] }>('/api/admin/tests', { query: { limit: 100 } })
const testItems = computed(() => (testData.value?.items ?? []).map(t => ({ label: `${t.title}${t.status === 'DRAFT' ? ' (draft: hidden until it opens)' : ''}`, value: t.id })))

/** Next Saturday 10:00 to Sunday 22:00, as local datetime-input values. */
function weekend() {
  const d = new Date()
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7))
  const day = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const sunday = new Date(d)
  sunday.setDate(d.getDate() + 1)
  return { startsAt: `${day(d)}T10:00`, endsAt: `${day(sunday)}T22:00` }
}
const creating = ref<{ testId: string | undefined, title: string, startsAt: string, endsAt: string } | null>(null)
const saving = ref(false)
function startCreate() {
  creating.value = { testId: undefined, title: 'Weekend live mock', ...weekend() }
}

async function create() {
  const c = creating.value
  if (!c) return
  saving.value = true
  try {
    await $fetch('/api/admin/live', { method: 'POST', body: { ...c, startsAt: new Date(c.startsAt).toISOString(), endsAt: new Date(c.endsAt).toISOString() } })
    toast.add({ title: 'Live mock scheduled', color: 'success' })
    creating.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not scheduled', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function cancel(m: Mock) {
  try {
    await $fetch(`/api/admin/live/${m.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not cancelled', description: errorMessage(e), color: 'error' })
  }
}
const STATE = {
  UPCOMING: { label: 'Upcoming', color: 'info' as const },
  LIVE: { label: 'Live', color: 'error' as const },
  ENDED: { label: 'Ended', color: 'neutral' as const }
}
const when = (d: string) => new Date(d).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <AppPage
    title="Live mocks"
    icon="i-lucide-trophy"
  >
    <template #actions>
      <UButton
        label="Schedule"
        icon="i-lucide-plus"
        @click="startCreate"
      />
    </template>

    <div class="flex flex-col gap-3 max-w-4xl w-full">
      <UEmpty
        v-if="!mocks.length"
        icon="i-lucide-trophy"
        title="No live mocks yet"
        description="Pick a test and a weekend: everyone sits it in the same window and is ranked on one leaderboard."
        :actions="[{ label: 'Schedule one', icon: 'i-lucide-plus', onClick: startCreate }]"
      />
      <UCard
        v-for="m in mocks"
        :key="m.id"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-3' }"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-highlighted">{{ m.title }}</span>
            <UBadge
              :label="STATE[m.state].label"
              :color="STATE[m.state].color"
              variant="subtle"
              size="sm"
            />
          </div>
          <p class="text-xs text-muted mt-1">
            {{ m.test.title }}{{ m.test.status === 'DRAFT' ? ' (draft)' : '' }} · {{ when(m.startsAt) }} – {{ when(m.endsAt) }}
            · {{ m.participants }} took part
            <template v-if="m.announcedAt">
              · announced
            </template>
            <template v-if="m.resultsSentAt">
              · results sent
            </template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="m.state !== 'UPCOMING'"
            :to="`/live?mock=${m.id}`"
            label="Leaderboard"
            icon="i-lucide-list-ordered"
            size="sm"
            color="neutral"
            variant="outline"
          />
          <UButton
            v-else
            label="Cancel"
            icon="i-lucide-x"
            size="sm"
            color="error"
            variant="ghost"
            @click="cancel(m)"
          />
        </div>
      </UCard>
    </div>

    <UModal
      :open="!!creating"
      title="Schedule a live mock"
      @update:open="v => !v && (creating = null)"
    >
      <template #body>
        <form
          v-if="creating"
          class="grid gap-4"
          @submit.prevent="create"
        >
          <UFormField label="Title">
            <UInput
              v-model="creating.title"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Test"
            help="A draft stays hidden until the mock opens, and joins the library when it closes."
          >
            <USelectMenu
              v-model="creating.testId"
              :items="testItems"
              value-key="value"
              placeholder="Pick a test"
              class="w-full"
            />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField label="Opens">
              <UInput
                v-model="creating.startsAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Closes">
              <UInput
                v-model="creating.endsAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="creating = null"
            />
            <UButton
              type="submit"
              label="Schedule"
              :loading="saving"
              :disabled="!creating.testId"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
