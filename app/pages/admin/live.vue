<script setup lang="ts">
/**
 * Live mocks: pick a test and a window (a weekend, say). A draft test stays hidden until the window
 * opens and joins the library when it closes; the bot announces the start and sends each participant
 * their place at the end. The bot also posts each mock to its Telegram channels (by default those of
 * its exam: one for IELTS, one for Multilevel, say): when it is scheduled, when it opens, and the top
 * of the board when it closes. Channels are added here. Windows may not overlap.
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
  exam: Exam
  channelIds: string[]
  test: { title: string | null, status: string | null }
}
interface Channel { id: string, chat: string, title: string, url: string | null, exam: Exam | null, locale: string, builtIn: boolean }

const toast = useToast()
const { data, refresh } = await useFetch<{ channels: Channel[], mocks: Mock[] }>('/api/admin/live', { default: () => ({ channels: [], mocks: [] }) })
const mocks = computed(() => data.value.mocks)
const channels = computed(() => data.value.channels)
const channelTitle = (id: string) => channels.value.find(c => c.id === id)?.title ?? id
const { data: testData } = await useFetch<{ items: { id: string, title: string, status: string, module?: string | null }[] }>('/api/admin/tests', { query: { limit: 100 } })
const testItems = computed(() => (testData.value?.items ?? []).map(t => ({ label: `${examLabel(examOfModule(t.module))} · ${t.title}${t.status === 'DRAFT' ? ' (draft: hidden until it opens)' : ''}`, value: t.id })))
const examOfTestId = (id?: string) => examOfModule(testData.value?.items.find(t => t.id === id)?.module)
/** The channels a mock of this exam goes to unless others are picked. */
const channelsFor = (exam: Exam) => channels.value.filter(c => !c.exam || c.exam === exam).map(c => c.id)

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
const form = ref<{ id?: string, state?: Mock['state'], testId: string | undefined, title: string, startsAt: string, endsAt: string, channelIds: string[] } | null>(null)
const saving = ref(false)
function startCreate() {
  form.value = { testId: undefined, title: 'Weekend live mock', ...weekend(), channelIds: [] }
}
function startEdit(m: Mock) {
  form.value = { id: m.id, state: m.state, testId: m.testId, title: m.title, startsAt: local(m.startsAt), endsAt: local(m.endsAt), channelIds: [...m.channelIds] }
}
/** Picking a test picks its exam's channels. */
function pickTest(id: string | undefined) {
  if (!form.value || !id || id === form.value.testId) return
  form.value.testId = id
  form.value.channelIds = channelsFor(examOfTestId(id))
}
const channelItems = computed(() => channels.value.map(c => ({ label: `${c.title}${c.exam ? ` · ${examLabel(c.exam)}` : ''}`, value: c.id })))
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
        body: { title: f.title, channelIds: f.channelIds, ...(opened.value ? {} : { testId: f.testId, startsAt: times.startsAt }), ...(ended.value ? {} : { endsAt: times.endsAt }) }
      })
      toast.add({ title: 'Live mock saved', color: 'success' })
    } else {
      const made = await $fetch<{ channel: { ok: boolean, error?: string, posts: { channel: string, ok: boolean }[] } | null }>('/api/admin/live', { method: 'POST', body: { testId: f.testId, title: f.title, channelIds: f.channelIds, ...times } })
      toast.add({
        title: 'Live mock scheduled',
        description: made.channel ? (made.channel.ok ? `Announced in ${made.channel.posts.map(p => p.channel).join(', ')}.` : `Not posted everywhere: ${made.channel.error}`) : undefined,
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
/** Posts a mock now: to its channels, or to the one given. */
async function post(m: Mock, channelIds?: string[]) {
  posting.value = m.id
  try {
    const res = await $fetch<{ ok: boolean, error?: string, posts: { channel: string, ok: boolean }[] }>(`/api/admin/live/${m.id}/post`, { method: 'POST', body: { channelIds } })
    const what = m.state === 'ENDED' ? 'The top of the board' : m.state === 'LIVE' ? 'That it is open now' : 'That it is coming'
    const done = res.posts.filter(p => p.ok).map(p => p.channel).join(', ')
    toast.add(res.ok
      ? { title: `Posted to ${done}`, description: `${what}.`, color: 'success' }
      : { title: `Posted to ${done} only`, description: res.error, color: 'warning' })
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
function postItems(m: Mock) {
  return [
    [{ label: 'Its channels', description: m.channelIds.map(channelTitle).join(', ') || 'none picked', icon: 'i-lucide-send', disabled: !m.channelIds.length, onSelect: () => post(m) }],
    channels.value.map(c => ({ label: c.title, description: c.exam ? examLabel(c.exam) : 'Both exams', icon: 'i-simple-icons-telegram', onSelect: () => post(m, [c.id]) }))
  ]
}

// ─── Channels ───
const EXAM_ITEMS = [{ label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel', value: 'MULTILEVEL' }, { label: 'Both exams', value: 'BOTH' }]
const LOCALE_ITEMS = [{ label: 'O\'zbekcha', value: 'uz' }, { label: 'Русский', value: 'ru' }, { label: 'English', value: 'en' }]
const adding = ref<{ chat: string, exam: string, locale: string } | null>(null)
const addingBusy = ref(false)
async function addChannel() {
  if (!adding.value) return
  addingBusy.value = true
  try {
    const c = await $fetch<{ title: string }>('/api/admin/channels', { method: 'POST', body: { ...adding.value, exam: adding.value.exam === 'BOTH' ? null : adding.value.exam } })
    toast.add({ title: `${c.title} added`, description: 'Mocks of its exam are posted there from now on.', color: 'success' })
    adding.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not added', description: errorMessage(e), color: 'error' })
  } finally {
    addingBusy.value = false
  }
}
async function changeChannel(c: Channel, body: { exam?: string | null, locale?: string }) {
  try {
    await $fetch(`/api/admin/channels/${c.id}`, { method: 'PATCH', body: { ...body, ...(body.exam === 'BOTH' ? { exam: null } : {}) } })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  }
}
async function removeChannel(c: Channel) {
  if (!confirm(`Stop posting live mocks to ${c.title}?`)) return
  try {
    await $fetch(`/api/admin/channels/${c.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not removed', description: errorMessage(e), color: 'error' })
  }
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
      <UCard :ui="{ body: 'flex flex-col gap-3' }">
        <div class="flex items-center gap-2">
          <UIcon
            name="i-simple-icons-telegram"
            class="size-4 shrink-0 text-[#229ED9]"
          />
          <p class="font-semibold text-highlighted flex-1">
            Telegram channels
          </p>
          <UButton
            v-if="!adding"
            label="Add channel"
            icon="i-lucide-plus"
            size="sm"
            color="neutral"
            variant="outline"
            @click="adding = { chat: '', exam: 'IELTS', locale: 'uz' }"
          />
        </div>
        <p class="text-xs text-muted">
          The bot posts each mock to the channels of its exam (or the ones picked for it): when it is scheduled, when it opens, and the top 10 when it closes. Make the bot an admin of a channel that can post messages, then add it.
        </p>
        <ul
          v-if="channels.length"
          class="divide-y divide-default rounded-lg border border-default"
          data-testid="channels"
        >
          <li
            v-for="c in channels"
            :key="c.id"
            class="flex flex-wrap items-center gap-2 px-3 py-2"
          >
            <div class="min-w-0 flex-1 basis-full sm:basis-0">
              <a
                v-if="c.url"
                :href="c.url"
                target="_blank"
                class="font-medium text-highlighted hover:text-primary truncate block"
              >{{ c.title }}</a>
              <span
                v-else
                class="font-medium text-highlighted truncate block"
              >{{ c.title }}</span>
              <span class="text-xs text-muted">{{ c.chat }}<template v-if="c.builtIn"> · TELEGRAM_CHANNEL (its exam and language are set on the server)</template></span>
            </div>
            <template v-if="c.builtIn">
              <UBadge
                :label="c.exam ? examLabel(c.exam) : 'Both exams'"
                color="neutral"
                variant="subtle"
              />
              <UBadge
                :label="LOCALE_ITEMS.find(i => i.value === c.locale)?.label ?? c.locale"
                color="neutral"
                variant="outline"
              />
            </template>
            <template v-else>
              <USelect
                :model-value="c.exam ?? 'BOTH'"
                :items="EXAM_ITEMS"
                size="sm"
                class="flex-1 sm:flex-none sm:w-32"
                @update:model-value="v => changeChannel(c, { exam: String(v) })"
              />
              <USelect
                :model-value="c.locale"
                :items="LOCALE_ITEMS"
                size="sm"
                class="flex-1 sm:flex-none sm:w-32"
                @update:model-value="v => changeChannel(c, { locale: String(v) })"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="sm"
                color="error"
                variant="ghost"
                :aria-label="`Remove ${c.title}`"
                @click="removeChannel(c)"
              />
            </template>
          </li>
        </ul>
        <p
          v-else-if="!adding"
          class="text-sm text-muted"
        >
          No channels yet: mocks are not posted anywhere.
        </p>
        <form
          v-if="adding"
          class="grid sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
          @submit.prevent="addChannel"
        >
          <UFormField label="Channel">
            <UInput
              v-model="adding.chat"
              placeholder="@ielts_channel or t.me/…"
              class="w-full"
              required
              autofocus
            />
          </UFormField>
          <UFormField label="For">
            <USelect
              v-model="adding.exam"
              :items="EXAM_ITEMS"
              class="w-full sm:w-36"
            />
          </UFormField>
          <UFormField label="Posts in">
            <USelect
              v-model="adding.locale"
              :items="LOCALE_ITEMS"
              class="w-full sm:w-36"
            />
          </UFormField>
          <div class="flex gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="adding = null"
            />
            <UButton
              type="submit"
              label="Add"
              :loading="addingBusy"
            />
          </div>
        </form>
      </UCard>
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
            · {{ examLabel(m.exam) }} · {{ m.participants }} took part
            <template v-if="m.announcedAt">
              · announced
            </template>
            <template v-if="m.resultsSentAt">
              · results sent
            </template>
          </p>
          <div class="flex flex-wrap items-center gap-1 mt-1.5">
            <UIcon
              name="i-simple-icons-telegram"
              class="size-3.5 text-muted"
            />
            <UBadge
              v-for="id in m.channelIds"
              :key="id"
              :label="channelTitle(id)"
              color="neutral"
              variant="soft"
              size="sm"
            />
            <span
              v-if="!m.channelIds.length"
              class="text-xs text-muted"
            >No channel</span>
          </div>
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
          <UDropdownMenu
            v-if="channels.length && (m.state !== 'ENDED' || m.participants)"
            :items="postItems(m)"
            :content="{ align: 'end' }"
          >
            <UButton
              label="Post"
              icon="i-simple-icons-telegram"
              trailing-icon="i-lucide-chevron-down"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="posting === m.id"
              data-testid="post-menu"
            />
          </UDropdownMenu>
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
              :model-value="form.testId"
              :items="testItems"
              value-key="value"
              placeholder="Pick a test"
              :disabled="opened"
              class="w-full"
              @update:model-value="pickTest"
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
          <UFormField
            v-if="channels.length"
            label="Post to"
            :help="form.testId ? `The ${examLabel(examOfTestId(form.testId))} channels are picked; the bot posts when it is scheduled, opens and closes.` : 'Picking a test picks the channels of its exam.'"
          >
            <UCheckboxGroup
              v-model="form.channelIds"
              :items="channelItems"
              data-testid="mock-channels"
            />
          </UFormField>
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
