<script setup lang="ts">
/**
 * Exam integrity: candidates whose tests look wrong (they left the page a lot, pasted into an essay,
 * finished impossibly fast with a high score, sat two sections at once, or used the account from many
 * places). Nothing was blocked: here an admin looks at the evidence and clears it, warns them (by
 * Telegram and push), takes a live-mock section off the board, or signs the account out everywhere.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Integrity', robots: 'noindex' })

type Flag = 'AWAY' | 'PASTE' | 'FAST' | 'PARALLEL' | 'DEVICES'
interface Row { id: string, name: string | null, email: string | null, telegramUsername: string | null, attempts: number, flags: Flag[] | null, lastAt: string, open: boolean, liveMock: boolean }
interface CaseAttempt {
  id: string
  skill: string
  partNumber: number | null
  startedAt: string | null
  submittedAt: string
  correct: number | null
  total: number | null
  score: number | null
  band: number | null
  exam: string
  integrity: { away?: number, awaySeconds?: number, fullscreenExits?: number, pastes?: number, pastedChars?: number, seconds?: number | null } | null
  flags: Flag[] | null
  status: string
  note: string | null
  reviewedAt: string | null
  liveMockId: string | null
  testTitle: string | null
}
interface Case { user: { id: string, name: string | null, email: string | null, telegramId: string | null, telegramUsername: string | null }, attempts: CaseAttempt[], networks: number, sessions: { device: string | null, ip: string | null, lastSeenAt: string, signedOut: boolean }[] }

const toast = useToast()
const status = ref('OPEN')
const q = ref('')
const { data: rows, refresh } = await useFetch<Row[]>('/api/admin/integrity', {
  query: computed(() => ({ status: status.value === 'OPEN' ? undefined : status.value, q: q.value || undefined })),
  default: () => []
})
const statusItems = [
  { label: 'To look at', value: 'OPEN' },
  { label: 'Flagged', value: 'FLAGGED' },
  { label: 'Warned', value: 'WARNED' },
  { label: 'Cleared', value: 'CLEARED' },
  { label: 'Disqualified', value: 'DISQUALIFIED' },
  { label: 'Everything', value: 'ALL' }
]
const FLAG: Record<Flag, { label: string, help: string, color: 'warning' | 'error' | 'info' | 'neutral' }> = {
  AWAY: { label: 'Left the page', help: 'Left the test page 3+ times or for a minute or more', color: 'warning' },
  PASTE: { label: 'Pasted', help: '200+ characters pasted into an essay', color: 'error' },
  FAST: { label: 'Too fast', help: '80%+ right at under 15 seconds a question', color: 'error' },
  PARALLEL: { label: 'Two at once', help: 'Another section of theirs was being sat over the same minutes: a shared account', color: 'error' },
  DEVICES: { label: 'Many places', help: 'Used from 4+ networks this week: a shared account', color: 'info' }
}
const STATUS_COLOR: Record<string, 'warning' | 'success' | 'info' | 'error' | 'neutral'> = { FLAGGED: 'warning', CLEARED: 'success', WARNED: 'info', DISQUALIFIED: 'error' }

const picked = ref<string | null>(null)
const { data: c, refresh: refreshCase } = await useFetch<Case>(() => `/api/admin/integrity/${picked.value}`, { immediate: false, watch: false })
watch(picked, id => id && refreshCase())
watch(rows, r => !picked.value && r[0] && (picked.value = r[0].id), { immediate: true })

const warnOpen = ref(false)
const message = ref('')
const note = ref('')
const busy = ref<string | null>(null)
async function act(action: 'CLEAR' | 'WARN' | 'DISQUALIFY', attemptIds?: string[]) {
  if (!picked.value) return
  busy.value = action
  try {
    const res = await $fetch<{ updated: number, delivered: boolean | null }>(`/api/admin/integrity/${picked.value}/decide`, { method: 'POST', body: { action, attemptIds, note: note.value, message: message.value } })
    toast.add({
      title: action === 'CLEAR' ? 'Cleared' : action === 'WARN' ? 'Warned' : 'Taken off the board',
      description: action === 'WARN' ? (res.delivered ? 'Sent on Telegram (and as a push).' : 'Not on Telegram: sent as a push only, if they allowed it.') : `${res.updated} attempt${res.updated === 1 ? '' : 's'}`,
      color: 'success'
    })
    warnOpen.value = false
    note.value = ''
    await Promise.all([refresh(), refreshCase()])
  } catch (e) {
    toast.add({ title: 'Not done', description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = null
  }
}
async function signOut() {
  if (!picked.value) return
  busy.value = 'SIGNOUT'
  try {
    const res = await $fetch<{ ended: number }>(`/api/admin/integrity/${picked.value}/sign-out`, { method: 'POST' })
    toast.add({ title: 'Signed out everywhere', description: `${res.ended} session${res.ended === 1 ? '' : 's'} ended`, color: 'success' })
    await refreshCase()
  } catch (e) {
    toast.add({ title: 'Not done', description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = null
  }
}

const when = (d: string | null) => (d ? localeDate(d, 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')
const mins = (s?: number | null) => (s == null ? '—' : s < 120 ? `${s}s` : `${Math.round(s / 60)} min`)
const what = (a: CaseAttempt) => `${a.testTitle ?? 'Test'} · ${skillLabel(a.skill)}${a.partNumber ? ` part ${a.partNumber}` : ''}`
const result = (a: CaseAttempt) => (a.band != null ? `Band ${fmtBand(a.band)}` : a.score != null ? `${a.score}/75` : a.total ? `${a.correct}/${a.total}` : '')
</script>

<template>
  <AppPage
    title="Integrity"
    icon="i-lucide-shield-alert"
  >
    <div class="flex flex-col gap-4 w-full">
      <p class="text-sm text-muted max-w-3xl">
        Tests that look wrong are flagged here; nobody is blocked or marked down automatically. Look at the evidence, then clear it, warn the candidate, take a live-mock section off the board, or sign the account out everywhere.
      </p>
      <div class="flex flex-wrap gap-2">
        <USelect
          v-model="status"
          :items="statusItems"
          class="w-44"
        />
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Name, email or Telegram"
          class="w-64"
        />
      </div>

      <div class="grid lg:grid-cols-[22rem_1fr] gap-4 items-start">
        <!-- The queue -->
        <div class="flex flex-col gap-2">
          <UEmpty
            v-if="!rows.length"
            icon="i-lucide-shield-check"
            title="Nothing to look at"
          />
          <button
            v-for="r in rows"
            :key="r.id"
            type="button"
            class="text-left rounded-xl ring p-3 transition-colors"
            :class="picked === r.id ? 'ring-primary bg-primary/5' : 'ring-default hover:bg-elevated/50'"
            data-testid="integrity-row"
            @click="picked = r.id"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium text-highlighted truncate flex-1">{{ r.name || r.email || r.telegramUsername || 'Unnamed' }}</span>
              <UBadge
                v-if="r.open"
                label="To look at"
                color="warning"
                variant="subtle"
                size="sm"
              />
            </div>
            <p class="text-xs text-muted truncate">
              {{ r.email || (r.telegramUsername ? `@${r.telegramUsername}` : '') }} · {{ r.attempts }} test{{ r.attempts === 1 ? '' : 's' }} · {{ when(r.lastAt) }}
            </p>
            <div class="flex flex-wrap gap-1 mt-1.5">
              <UBadge
                v-for="f in r.flags ?? []"
                :key="f"
                :label="FLAG[f]?.label ?? f"
                :color="FLAG[f]?.color ?? 'neutral'"
                variant="soft"
                size="sm"
              />
              <UBadge
                v-if="r.liveMock"
                label="Live mock"
                color="primary"
                variant="soft"
                size="sm"
              />
            </div>
          </button>
        </div>

        <!-- The evidence -->
        <UCard v-if="c && picked">
          <template #header>
            <div class="flex flex-wrap items-center gap-2">
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-highlighted">
                  {{ c.user.name || c.user.email || 'Unnamed' }}
                </p>
                <p class="text-xs text-muted">
                  {{ c.user.email }}<template v-if="c.user.telegramUsername">
                    · @{{ c.user.telegramUsername }}
                  </template> · {{ c.networks }} network{{ c.networks === 1 ? '' : 's' }} this week
                </p>
              </div>
              <UButton
                label="Clear all"
                icon="i-lucide-check"
                size="sm"
                color="success"
                variant="soft"
                :loading="busy === 'CLEAR'"
                @click="act('CLEAR')"
              />
              <UButton
                label="Warn"
                icon="i-lucide-message-square-warning"
                size="sm"
                color="warning"
                variant="soft"
                @click="warnOpen = true"
              />
              <UButton
                label="Sign out everywhere"
                icon="i-lucide-log-out"
                size="sm"
                color="error"
                variant="soft"
                :loading="busy === 'SIGNOUT'"
                @click="signOut"
              />
            </div>
          </template>

          <div class="flex flex-col gap-5">
            <ul class="flex flex-col divide-y divide-default rounded-lg ring ring-default">
              <li
                v-for="a in c.attempts"
                :key="a.id"
                class="p-3 flex flex-col gap-2"
                data-testid="integrity-attempt"
              >
                <div class="flex flex-wrap items-center gap-2">
                  <NuxtLink
                    :to="`/results/${a.id}`"
                    class="font-medium text-highlighted hover:text-primary"
                  >{{ what(a) }}</NuxtLink>
                  <span class="text-sm text-muted">{{ result(a) }}</span>
                  <UBadge
                    :label="a.status.toLowerCase()"
                    :color="STATUS_COLOR[a.status] ?? 'neutral'"
                    variant="subtle"
                    size="sm"
                  />
                  <UBadge
                    v-if="a.liveMockId"
                    label="Live mock"
                    color="primary"
                    variant="soft"
                    size="sm"
                  />
                  <span class="ms-auto text-xs text-muted">{{ when(a.startedAt) }} → {{ when(a.submittedAt) }}</span>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <UTooltip
                    v-for="f in a.flags ?? []"
                    :key="f"
                    :text="FLAG[f]?.help"
                  >
                    <UBadge
                      :label="FLAG[f]?.label ?? f"
                      :color="FLAG[f]?.color ?? 'neutral'"
                      variant="soft"
                      size="sm"
                    />
                  </UTooltip>
                </div>
                <p class="text-xs text-muted">
                  Took {{ mins(a.integrity?.seconds) }} · left the page {{ a.integrity?.away ?? 0 }}× ({{ mins(a.integrity?.awaySeconds ?? 0) }})
                  · left full screen {{ a.integrity?.fullscreenExits ?? 0 }}× · pasted {{ a.integrity?.pastes ?? 0 }}× ({{ a.integrity?.pastedChars ?? 0 }} characters)
                </p>
                <p
                  v-if="a.note"
                  class="text-xs text-toned"
                >
                  Note: {{ a.note }}
                </p>
                <div class="flex gap-2">
                  <UButton
                    v-if="a.status !== 'CLEARED'"
                    label="Clear"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    @click="act('CLEAR', [a.id])"
                  />
                  <UButton
                    v-if="a.liveMockId && a.status !== 'DISQUALIFIED'"
                    label="Take off the board"
                    size="xs"
                    color="error"
                    variant="outline"
                    @click="act('DISQUALIFY', [a.id])"
                  />
                </div>
              </li>
            </ul>

            <div>
              <p class="text-xs font-semibold text-muted mb-2">
                Signed in from (this week)
              </p>
              <ul class="flex flex-col gap-1 text-xs">
                <li
                  v-for="(s, i) in c.sessions"
                  :key="i"
                  class="flex flex-wrap gap-2"
                  :class="s.signedOut ? 'text-dimmed line-through' : 'text-toned'"
                >
                  <span class="font-mono">{{ s.ip || '—' }}</span>
                  <span class="truncate max-w-md">{{ s.device || 'Unknown device' }}</span>
                  <span class="ms-auto">{{ when(s.lastSeenAt) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <UModal
      v-model:open="warnOpen"
      title="Warn the candidate"
      description="Sent on Telegram (if they use the bot) and as a push. Their flagged tests are marked as warned."
    >
      <template #body>
        <div class="flex flex-col gap-3">
          <UTextarea
            v-model="message"
            :rows="4"
            autoresize
            placeholder="We noticed unusual activity during your recent tests on Mockmee. Please sit tests on your own, on one device, without leaving the test page. Repeated activity like this can lead to losing access."
            class="w-full"
          />
          <UInput
            v-model="note"
            placeholder="Note for admins (optional)"
            class="w-full"
          />
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="warnOpen = false"
            />
            <UButton
              label="Send warning"
              color="warning"
              :loading="busy === 'WARN'"
              @click="act('WARN')"
            />
          </div>
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
