<script setup lang="ts">
/**
 * Live mocks: pick a test and a window (a weekend, say). A draft test stays hidden until the window
 * opens and joins the library when it closes; the bot announces the start and sends each participant
 * their place at the end. With a Telegram channel set up, the bot also posts there: when a mock is
 * scheduled, when it opens, and the top of the board when it closes. Windows may not overlap.
 * A mock can be edited: before it opens, everything; while it runs, its title and when it closes;
 * after, its title.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Live mocks', robots: 'noindex' })

interface Mock {
  id: string
  testId: string
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
const { data, refresh } = await useFetch<{ channel: string | null, mocks: Mock[] }>('/api/admin/live', { default: () => ({ channel: null, mocks: [] }) })
const mocks = computed(() => data.value.mocks)
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
/** An ISO time as a datetime-local value, in this browser's time zone. */
const local = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
/** The form, for a new mock or one being edited (`id`, with its state deciding what can change). */
const form = ref<{ id?: string, state?: Mock['state'], testId: string | undefined, title: string, startsAt: string, endsAt: string } | null>(null)
const saving = ref(false)
function startCreate() {
  form.value = { testId: undefined, title: 'Weekend live mock', ...weekend() }
}
function startEdit(m: Mock) {
  form.value = { id: m.id, state: m.state, testId: m.testId, title: m.title, startsAt: local(m.startsAt), endsAt: local(m.endsAt) }
}
const opened = computed(() => !!form.value?.id && form.value.state !== 'UPCOMING')
const ended = computed(() => form.value?.state === 'ENDED')

async function save() {
  const f = form.value
  if (!f) return
  saving.value = true
  try {
    const times = { startsAt: new Date(f.startsAt).toISOString(), endsAt: new Date(f.endsAt).toISOString() }
    if (f.id) {
      await $fetch(`/api/admin/live/${f.id}`, {
        method: 'PATCH',
        body: { title: f.title, ...(opened.value ? {} : { testId: f.testId, startsAt: times.startsAt }), ...(ended.value ? {} : { endsAt: times.endsAt }) }
      })
      toast.add({ title: 'Live mock saved', color: 'success' })
    } else {
      const made = await $fetch<{ channel: { ok: boolean, error?: string } | null }>('/api/admin/live', { method: 'POST', body: { testId: f.testId, title: f.title, ...times } })
      toast.add({
        title: 'Live mock scheduled',
        description: made.channel ? (made.channel.ok ? 'Announced in the Telegram channel.' : `Not posted to the channel: ${made.channel.error}`) : undefined,
        color: made.channel && !made.channel.ok ? 'warning' : 'success'
      })
    }
    form.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

const posting = ref<string | null>(null)
async function post(m: Mock) {
  posting.value = m.id
  try {
    await $fetch(`/api/admin/live/${m.id}/post`, { method: 'POST' })
    toast.add({ title: 'Posted to the channel', description: m.state === 'ENDED' ? 'The top of the board.' : m.state === 'LIVE' ? 'That it is open now.' : 'That it is coming.', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Not posted', description: errorMessage(e), color: 'error' })
  } finally {
    posting.value = null
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
const when = (d: string) => localeDate(d, 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
      <p class="text-sm text-muted flex items-center gap-2">
        <UIcon
          name="i-simple-icons-telegram"
          class="size-4 shrink-0"
        />
        <template v-if="data.channel">
          The bot posts each mock to <a
            :href="data.channel"
            target="_blank"
            class="text-primary"
          >{{ data.channel.replace(/^https:\/\//, '') }}</a>: when it is scheduled, when it opens, and the top 10 when it closes.
        </template>
        <template v-else>
          Set TELEGRAM_CHANNEL (and make the bot an admin of the channel that can post) to post live mocks there.
        </template>
      </p>
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
            label="Edit"
            icon="i-lucide-pencil"
            size="sm"
            color="neutral"
            variant="outline"
            @click="startEdit(m)"
          />
          <UButton
            v-if="data.channel && (m.state !== 'ENDED' || m.participants)"
            label="Post to channel"
            icon="i-simple-icons-telegram"
            size="sm"
            color="neutral"
            variant="outline"
            :loading="posting === m.id"
            @click="post(m)"
          />
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
      :open="!!form"
      :title="form?.id ? 'Edit live mock' : 'Schedule a live mock'"
      @update:open="v => !v && (form = null)"
    >
      <template #body>
        <form
          v-if="form"
          class="grid gap-4"
          @submit.prevent="save"
        >
          <UAlert
            v-if="opened"
            color="neutral"
            variant="subtle"
            icon="i-lucide-info"
            :description="ended ? 'It has ended: only its title can change.' : 'It has started: its test and opening time stay; you can still change when it closes.'"
          />
          <UFormField label="Title">
            <UInput
              v-model="form.title"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Test"
            help="A draft stays hidden until the mock opens, and joins the library when it closes."
          >
            <USelectMenu
              v-model="form.testId"
              :items="testItems"
              value-key="value"
              placeholder="Pick a test"
              :disabled="opened"
              class="w-full"
            />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField label="Opens">
              <UInput
                v-model="form.startsAt"
                type="datetime-local"
                :disabled="opened"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Closes">
              <UInput
                v-model="form.endsAt"
                type="datetime-local"
                :disabled="ended"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="form = null"
            />
            <UButton
              type="submit"
              :label="form.id ? 'Save' : 'Schedule'"
              :loading="saving"
              :disabled="!form.testId"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
