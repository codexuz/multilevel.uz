<script setup lang="ts">
/**
 * The invigilator's board for one mock session. Candidates are added (the centre's students, or
 * walk-ins registered at the desk) and checked in once their ID is seen: each gets a six-digit seat
 * code, printed on a slip if wanted. Sections are opened for the room together (or for a late
 * candidate), and the board shows, every few seconds, who is sitting what and what their exam page
 * notices (left the page, pasted, left full screen). Listening and Reading are marked at once;
 * Writing carries the AI's estimate until a mark is given; Speaking, held face to face, is marked
 * here. Complete results are announced as a report page with a QR code.
 */
const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const id = String(route.params.id)

type Status = 'LOCKED' | 'OPEN' | 'SITTING' | 'DONE' | 'FACE_TO_FACE'
interface Sec { status: Status, attemptId?: string, mark?: number | null, estimate?: number | null, correct?: number | null, total?: number | null, flags?: string[] | null, integrity?: any, given?: boolean }
interface Cand {
  id: string
  fullName: string
  phone: string | null
  documentNo: string | null
  external: boolean
  paidUzs: number | null
  paymentMethod: string | null
  checkedInAt: string | null
  seatCode: string | null
  seatedAt: string | null
  unlockedSkills: string[]
  live: { skill?: string, flags: string[], signals?: any, at?: string } | null
  sections: Record<string, Sec>
  complete: boolean
  overall: number | null
  cefr: string | null
  releasedAt: string | null
  reportToken: string | null
}
interface Board {
  session: { id: string, title: string, opensAt: string, closesAt: string, room: string | null, capacity: number | null, priceUzs: number | null, holdResults: boolean, status: string, centreId: string | null, centreName: string | null }
  test: { slug: string, title: string, exam: 'IELTS' | 'MULTILEVEL', module: string }
  skills: string[]
  credits: number
  candidates: Cand[]
  summary: { total: number, checkedIn: number, seated: number, sitting: number, complete: number, announced: number, paidUzs: number }
}
const { data: b, refresh, error } = await useFetch<Board>(`/api/mocks/${id}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: t('mocks.notFound'), fatal: true })
useSeoMeta({ title: () => b.value?.session.title ?? t('mocks.title'), robots: 'noindex' })

// The board follows the room every few seconds while the page is open.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => document.visibilityState === 'visible' && refresh(), 5000)))
onBeforeUnmount(() => clearInterval(timer))

const ielts = computed(() => b.value?.test.exam === 'IELTS')
const online = computed(() => (b.value?.skills ?? []).filter(s => s !== 'SPEAKING'))
const fmtMark = (m: number | null | undefined) => (m == null ? '—' : ielts.value ? fmtBand(m) : String(m))
const busy = ref<string | null>(null)
async function call<T>(key: string, url: string, body?: any, method: 'POST' | 'PATCH' | 'DELETE' = 'POST'): Promise<T | null> {
  busy.value = key
  try {
    const res = await $fetch<T>(url, { method, body })
    await refresh()
    return res
  } catch (e: any) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: e?.statusCode === 402 ? 'warning' : 'error' })
    return null
  } finally {
    busy.value = null
  }
}

// ─── The room ───
const openFor = (skill: string) => b.value!.candidates.filter(c => c.unlockedSkills.includes(skill)).length
const doneFor = (skill: string) => b.value!.candidates.filter(c => c.sections[skill]?.status === 'DONE').length
const roomOpen = (skill: string, open: boolean) => call(`room-${skill}`, `/api/mocks/${id}/unlock`, { skills: [skill], open })
const candidateOpen = (c: Cand, skill: string, open: boolean) => call(`open-${c.id}-${skill}`, `/api/mocks/${id}/unlock`, { skills: [skill], candidateIds: [c.id], open })

// ─── Candidates ───
const walkIn = ref<{ fullName: string, phone: string, documentNo: string, paidUzs?: number, paymentMethod: string } | null>(null)
function startWalkIn() {
  walkIn.value = { fullName: '', phone: '', documentNo: '', paidUzs: b.value?.session.priceUzs ?? undefined, paymentMethod: 'CASH' }
}
async function addWalkIn() {
  if (await call('walkin', `/api/mocks/${id}/candidates`, { walkIn: walkIn.value })) walkIn.value = null
}
const studentsOpen = ref(false)
const picked = ref<string[]>([])
const { data: students, execute: loadStudents } = useFetch<{ id: string, name: string | null, email: string | null }[]>(`/api/mocks/${id}/students`, { immediate: false, default: () => [] })
async function openStudents() {
  picked.value = []
  studentsOpen.value = true
  await loadStudents()
}
async function addStudents() {
  if (await call('students', `/api/mocks/${id}/candidates`, { studentIds: picked.value })) studentsOpen.value = false
}

const codeShown = ref<{ name: string, code: string } | null>(null)
async function checkIn(c: Cand) {
  const res = await call<{ code: string }>(`checkin-${c.id}`, `/api/mocks/${id}/candidates/${c.id}/check-in`)
  if (res) codeShown.value = { name: c.fullName, code: res.code }
}
async function remove(c: Cand) {
  if (!await confirm({ title: t('mocks.removeConfirm', { name: c.fullName }), confirmLabel: t('mocks.remove'), color: 'error' })) return
  await call(`remove-${c.id}`, `/api/mocks/${id}/candidates/${c.id}`, undefined, 'DELETE')
}
async function mark(c: Cand, skill: 'WRITING' | 'SPEAKING', value: string) {
  const v = value.trim() === '' ? null : Number(value)
  await call(`mark-${c.id}-${skill}`, `/api/mocks/${id}/candidates/${c.id}/marks`, { [skill]: v })
}
async function announce(ids?: string[]) {
  const res = await call<{ announced: number, waiting: string[] }>('release', `/api/mocks/${id}/release`, { candidateIds: ids })
  if (res) toast.add({ title: t('mocks.announced', { n: res.announced }, res.announced), description: res.waiting.length ? t('mocks.stillMarking', { names: res.waiting.join(', ') }) : undefined, color: 'success' })
}
const reportUrl = (c: Cand) => `${location.origin}/report/${c.reportToken}`
async function copyReport(c: Cand) {
  try {
    await navigator.clipboard.writeText(reportUrl(c))
    toast.add({ title: t('mocks.linkCopied'), color: 'success' })
  } catch {}
}

/** A slip to hand the candidate: their name and seat code (cut out and kept at the desk). */
function printCode(name: string, code: string) {
  const s = b.value!.session
  const w = window.open('', '_blank', 'width=420,height=520')
  if (!w) return
  const esc = (x: string) => x.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(name)}</title>
    <body style="font-family:Arial,sans-serif;text-align:center;padding:24px">
    <p style="margin:0;color:#555">${esc(s.centreName ?? 'Mockmee')} · ${esc(s.title)}${s.room ? ` · ${esc(s.room)}` : ''}</p>
    <h2 style="margin:12px 0 4px">${esc(name)}</h2>
    <p style="margin:0 0 16px;color:#555">${esc(t('mocks.slipSeatCode'))}</p>
    <div style="font-size:48px;font-weight:700;letter-spacing:10px">${esc(code)}</div>
    <p style="margin-top:16px;color:#555;font-size:13px">${esc(t('mocks.slipHow'))}</p>
    <scr${''}ipt>window.onload=()=>{window.print()}</scr${''}ipt></body>`)
  w.document.close()
}

const flagLabel = (f: string) => t(`mocks.flag.${f}`)
// A section's state as a coloured dot and text in the candidates table.
const STATUS_DOT: Record<Status, string> = { LOCKED: 'bg-(--ui-border-accented)', OPEN: 'bg-info', SITTING: 'bg-warning', DONE: 'bg-success', FACE_TO_FACE: 'bg-primary' }
const STATUS_TEXT: Record<Status, string> = { LOCKED: 'text-dimmed', OPEN: 'text-info', SITTING: 'text-warning', DONE: 'text-success', FACE_TO_FACE: 'text-primary' }
const sec = (c: Cand, skill: string): Sec => c.sections[skill] ?? { status: 'LOCKED' }
/** What the exam page counted while this section was sat (live), or null when there is nothing yet. */
function signalsOf(c: Cand, skill: string) {
  const s = c.live?.skill === skill ? c.live.signals : null
  if (!s) return null
  return { away: s.away ?? 0, pastes: s.pastes ?? 0, fs: s.fullscreenExits ?? 0 }
}
const flagsOf = (c: Cand, skill: string) => [...new Set([...(sec(c, skill).flags ?? []), ...(c.live?.skill === skill ? c.live.flags : [])])]
// The session as the list shows it: upcoming, running, closed or archived.
const STATE_COLOR = { archived: 'neutral', closed: 'neutral', running: 'success', upcoming: 'info' } as const
const sessionState = computed<keyof typeof STATE_COLOR>(() => {
  const s = b.value!.session
  return s.status === 'ARCHIVED' ? 'archived' : Date.now() > Date.parse(s.closesAt) ? 'closed' : Date.now() >= Date.parse(s.opensAt) ? 'running' : 'upcoming'
})
const stats = computed(() => {
  const m = b.value!.summary
  return [
    { key: 'total', value: m.total }, { key: 'checkedIn', value: m.checkedIn }, { key: 'seated', value: m.seated },
    { key: 'sitting', value: m.sitting }, { key: 'complete', value: m.complete }, { key: 'announced', value: m.announced },
    ...(m.paidUzs ? [{ key: 'paid', value: fmtUzs(m.paidUzs) }] : [])
  ]
})
const when = (d: string) => localeDate(d, intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const hold = (v: boolean) => call('hold', `/api/mocks/${id}`, { holdResults: v }, 'PATCH')
const archive = () => call('archive', `/api/mocks/${id}`, { status: b.value!.session.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED' }, 'PATCH')
const ready = computed(() => (b.value?.candidates ?? []).filter(c => c.complete && !c.releasedAt).length)
// Nobody has begun (no seat taken, nothing handed in): the session can still be deleted.
const started = computed(() => (b.value?.candidates ?? []).some(c => c.seatedAt || Object.values(c.sections).some(s => s.status === 'DONE')))
const { confirm } = useDialogs()
async function removeSession() {
  const checked = b.value!.summary.checkedIn
  if (!await confirm({ title: t('mocks.deleteTitle', { title: b.value!.session.title }), description: checked ? t('mocks.deleteRefund', { n: checked }, checked) : t('mocks.deleteText'), confirmLabel: t('mocks.delete'), color: 'error' })) return
  if (await call('delete', `/api/mocks/${id}`, undefined, 'DELETE')) await navigateTo('/mocks')
}
</script>

<template>
  <AppPage
    v-if="b"
    :title="b.session.title"
    back="/mocks"
  >
    <template #actions>
      <UButton
        :href="`/api/mocks/${id}/results.csv`"
        :label="t('mocks.export')"
        icon="i-lucide-download"
        color="neutral"
        variant="ghost"
        class="max-sm:hidden"
      />
      <UDropdownMenu
        :items="[[
          { label: t('mocks.export'), icon: 'i-lucide-download', to: `/api/mocks/${id}/results.csv`, external: true, class: 'sm:hidden' },
          { label: b.session.status === 'ARCHIVED' ? t('mocks.restore') : t('mocks.archive'), icon: b.session.status === 'ARCHIVED' ? 'i-lucide-archive-restore' : 'i-lucide-archive', onSelect: archive },
          ...(!started ? [{ label: t('mocks.delete'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: removeSession }] : [])
        ]]"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          square
          :aria-label="t('mocks.more')"
          data-testid="session-menu"
        />
      </UDropdownMenu>
    </template>

    <div class="flex flex-col gap-6 w-full max-w-6xl">
      <!-- What the session is -->
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
          <UBadge
            :label="t(`mocks.state.${sessionState}`)"
            :color="STATE_COLOR[sessionState]"
            variant="subtle"
            class="rounded-full"
          />
          <span class="inline-flex items-center gap-1.5"><UIcon
            name="i-lucide-file-text"
            class="size-4 text-dimmed"
          />{{ examLabel(b.test.exam) }} · {{ b.test.title }}</span>
          <span class="inline-flex items-center gap-1.5"><UIcon
            name="i-lucide-calendar-clock"
            class="size-4 text-dimmed"
          />{{ when(b.session.opensAt) }} – {{ when(b.session.closesAt) }}</span>
          <span
            v-if="b.session.room"
            class="inline-flex items-center gap-1.5"
          ><UIcon
            name="i-lucide-door-open"
            class="size-4 text-dimmed"
          />{{ b.session.room }}</span>
          <span
            v-if="b.session.centreName"
            class="inline-flex items-center gap-1.5"
          ><UIcon
            name="i-lucide-school"
            class="size-4 text-dimmed"
          />{{ b.session.centreName }}</span>
        </div>
        <div class="flex items-center gap-4 shrink-0">
          <USwitch
            :model-value="b.session.holdResults"
            :label="t('mocks.holdShort')"
            size="sm"
            @update:model-value="v => hold(!!v)"
          />
          <span
            class="text-sm tabular-nums"
            :class="b.credits ? 'text-muted' : 'text-error font-medium'"
          >{{ t('mocks.credits', { n: b.credits }, b.credits) }}</span>
        </div>
      </div>

      <!-- Where things stand -->
      <!-- One panel, its cells parted by hairlines (the gap shows the border colour beneath) -->
      <div
        class="grid grid-cols-3 sm:grid-cols-6 gap-px rounded-lg overflow-hidden ring ring-default bg-(--ui-border)"
        :class="b.summary.paidUzs ? 'lg:grid-cols-7' : ''"
        data-testid="stats"
      >
        <div
          v-for="s in stats"
          :key="s.key"
          class="bg-default px-4 py-3"
          :class="s.key === 'paid' ? 'col-span-3 sm:col-span-6 lg:col-span-1' : ''"
        >
          <p class="text-xs text-muted">
            {{ t(`mocks.stat.${s.key}`) }}
          </p>
          <p class="text-xl font-semibold text-highlighted tabular-nums mt-0.5 whitespace-nowrap">
            {{ s.value }}
          </p>
        </div>
      </div>

      <!-- The room: each section opened for everyone together -->
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold text-highlighted">
          {{ t('mocks.sections') }}
        </h2>
        <div class="rounded-lg ring ring-default divide-y divide-default bg-default">
          <div
            v-for="skill in online"
            :key="skill"
            class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            :data-testid="`room-${skill.toLowerCase()}`"
          >
            <div class="flex items-center gap-2.5 w-40 shrink-0">
              <UIcon
                :name="SKILL_META[skill as keyof typeof SKILL_META].icon"
                class="size-4 text-muted"
              />
              <span class="font-medium text-highlighted">{{ skillLabel(skill) }}</span>
            </div>
            <div class="flex-1 min-w-48 flex items-center gap-3">
              <UProgress
                :model-value="b.summary.total ? Math.round((doneFor(skill) / b.summary.total) * 100) : 0"
                size="xs"
                class="max-w-56"
              />
              <span class="text-sm text-muted tabular-nums whitespace-nowrap">{{ t('mocks.handedIn', { done: doneFor(skill), total: b.summary.total }) }}</span>
              <span
                v-if="openFor(skill)"
                class="inline-flex items-center gap-1 text-xs text-info whitespace-nowrap"
              ><span class="size-1.5 rounded-full bg-info" />{{ t('mocks.openNow', { n: openFor(skill) }) }}</span>
            </div>
            <div class="flex items-center gap-2 ms-auto">
              <UButton
                v-if="openFor(skill)"
                :label="t('mocks.close')"
                size="sm"
                color="neutral"
                variant="ghost"
                @click="roomOpen(skill, false)"
              />
              <UButton
                :label="t('mocks.openForRoom')"
                icon="i-lucide-lock-open"
                size="sm"
                color="neutral"
                variant="outline"
                :loading="busy === `room-${skill}`"
                :disabled="!b.summary.checkedIn"
                @click="roomOpen(skill, true)"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- The candidates -->
      <section class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-sm font-semibold text-highlighted me-auto">
            {{ t('mocks.candidatesTitle') }}
          </h2>
          <UButton
            v-if="b.session.centreId"
            :label="t('mocks.addStudents')"
            icon="i-lucide-users"
            size="sm"
            color="neutral"
            variant="outline"
            @click="openStudents"
          />
          <UButton
            :label="t('mocks.addWalkIn')"
            icon="i-lucide-user-plus"
            size="sm"
            color="neutral"
            variant="outline"
            data-testid="add-walkin"
            @click="startWalkIn"
          />
          <UButton
            :label="t('mocks.announceReady', { n: ready })"
            icon="i-lucide-send"
            size="sm"
            :disabled="!ready"
            :loading="busy === 'release'"
            data-testid="announce"
            @click="announce()"
          />
        </div>

        <div
          v-if="!b.candidates.length"
          class="rounded-lg ring ring-default bg-default"
        >
          <UEmpty
            icon="i-lucide-users"
            :title="t('mocks.noCandidates')"
            :description="t('mocks.noCandidatesText')"
            variant="naked"
          />
        </div>

        <div
          v-else
          class="rounded-lg ring ring-default bg-default overflow-x-auto"
        >
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-muted text-start border-b border-default">
                <th class="font-medium text-start px-4 py-2.5 min-w-52">
                  {{ t('mocks.candidate') }}
                </th>
                <th class="font-medium text-start px-3 py-2.5 w-36">
                  {{ t('mocks.seat') }}
                </th>
                <th
                  v-for="skill in b.skills"
                  :key="skill"
                  class="font-medium text-start px-3 py-2.5 min-w-40"
                >
                  {{ skillLabel(skill) }}
                </th>
                <th class="font-medium text-start px-3 py-2.5 w-24">
                  {{ t('mocks.overall') }}
                </th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr
                v-for="c in b.candidates"
                :key="c.id"
                class="align-top"
                data-testid="candidate"
              >
                <!-- Who -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-highlighted truncate">{{ c.fullName }}</span>
                    <span
                      v-if="c.external"
                      class="text-[11px] text-muted border border-default rounded px-1 leading-4"
                    >{{ t('mocks.walkIn') }}</span>
                  </div>
                  <p class="text-xs text-muted mt-0.5 truncate">
                    {{ [c.phone, c.documentNo, c.paidUzs ? `${fmtUzs(c.paidUzs)} · ${c.paymentMethod === 'CARD' ? t('mocks.card') : t('mocks.cash')}` : null].filter(Boolean).join(' · ') || '—' }}
                  </p>
                </td>

                <!-- Check-in and the seat -->
                <td class="px-3 py-3">
                  <UButton
                    v-if="!c.checkedInAt"
                    :label="t('mocks.checkIn')"
                    icon="i-lucide-id-card"
                    size="xs"
                    color="neutral"
                    variant="outline"
                    :loading="busy === `checkin-${c.id}`"
                    data-testid="check-in"
                    @click="checkIn(c)"
                  />
                  <div
                    v-else-if="c.seatCode"
                    class="flex items-center gap-1"
                  >
                    <span
                      class="font-mono font-semibold tracking-wider text-highlighted"
                      data-testid="seat-code"
                    >{{ c.seatCode }}</span>
                    <UButton
                      icon="i-lucide-printer"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('mocks.printSlip')"
                      @click="printCode(c.fullName, c.seatCode)"
                    />
                  </div>
                  <span
                    v-else-if="c.seatedAt"
                    class="inline-flex items-center gap-1.5 text-success"
                  ><UIcon
                    name="i-lucide-monitor-check"
                    class="size-4"
                  />{{ t('mocks.seated') }}</span>
                </td>

                <!-- Each section -->
                <td
                  v-for="skill in b.skills"
                  :key="skill"
                  class="px-3 py-3"
                >
                  <div class="flex flex-col gap-1.5">
                    <span
                      class="inline-flex items-center gap-1.5 text-xs"
                      :class="STATUS_TEXT[sec(c, skill).status]"
                    >
                      <span
                        class="size-1.5 rounded-full"
                        :class="STATUS_DOT[sec(c, skill).status]"
                      />{{ t(`mocks.status.${sec(c, skill).status}`) }}
                    </span>
                    <!-- Listening and Reading: the mark -->
                    <span
                      v-if="sec(c, skill).status === 'DONE' && skill !== 'WRITING'"
                      class="tabular-nums"
                    >
                      <span class="font-semibold text-highlighted">{{ fmtMark(sec(c, skill).mark) }}</span>
                      <span
                        v-if="sec(c, skill).total"
                        class="text-muted text-xs"
                      > · {{ sec(c, skill).correct }}/{{ sec(c, skill).total }}</span>
                    </span>
                    <!-- Writing (handed in) and Speaking: the mark is given here -->
                    <div
                      v-else-if="(skill === 'WRITING' && sec(c, skill).status === 'DONE') || (skill === 'SPEAKING' && c.checkedInAt)"
                      class="flex items-center gap-2"
                    >
                      <UInput
                        :model-value="sec(c, skill).given ? String(sec(c, skill).mark ?? '') : ''"
                        :placeholder="sec(c, skill).estimate != null ? t('mocks.aiEstimate', { mark: fmtMark(sec(c, skill).estimate) }) : (ielts ? '0–9' : '0–75')"
                        size="xs"
                        class="w-24"
                        :disabled="!!c.releasedAt"
                        :data-testid="`mark-${skill.toLowerCase()}`"
                        @change="(e: Event) => mark(c, skill as 'WRITING' | 'SPEAKING', (e.target as HTMLInputElement).value)"
                      />
                      <NuxtLink
                        v-if="sec(c, skill).attemptId"
                        :to="`/results/${sec(c, skill).attemptId}`"
                        target="_blank"
                        class="text-xs text-primary hover:underline"
                      >{{ t('mocks.read') }}</NuxtLink>
                    </div>
                    <button
                      v-else-if="sec(c, skill).status === 'LOCKED' && c.checkedInAt && skill !== 'SPEAKING'"
                      type="button"
                      class="self-start inline-flex items-center gap-1 text-xs text-muted hover:text-primary"
                      @click="candidateOpen(c, skill, true)"
                    >
                      <UIcon
                        name="i-lucide-lock-open"
                        class="size-3"
                      />{{ t('mocks.openFor') }}
                    </button>
                    <!-- What the exam page noticed: counted quietly, highlighted only when it happened -->
                    <div
                      v-if="signalsOf(c, skill)"
                      class="flex items-center gap-2.5 text-[11px] tabular-nums"
                      :title="t('mocks.seen', signalsOf(c, skill)!)"
                    >
                      <span
                        class="inline-flex items-center gap-0.5"
                        :class="signalsOf(c, skill)!.away ? 'text-warning' : 'text-dimmed'"
                      ><UIcon
                        name="i-lucide-app-window"
                        class="size-3"
                      />{{ signalsOf(c, skill)!.away }}</span>
                      <span
                        class="inline-flex items-center gap-0.5"
                        :class="signalsOf(c, skill)!.pastes ? 'text-warning' : 'text-dimmed'"
                      ><UIcon
                        name="i-lucide-clipboard-paste"
                        class="size-3"
                      />{{ signalsOf(c, skill)!.pastes }}</span>
                      <span
                        class="inline-flex items-center gap-0.5"
                        :class="signalsOf(c, skill)!.fs ? 'text-warning' : 'text-dimmed'"
                      ><UIcon
                        name="i-lucide-minimize"
                        class="size-3"
                      />{{ signalsOf(c, skill)!.fs }}</span>
                    </div>
                    <span
                      v-for="f in flagsOf(c, skill)"
                      :key="f"
                      class="text-[11px] text-error"
                    >{{ flagLabel(f) }}</span>
                  </div>
                </td>

                <!-- Overall -->
                <td class="px-3 py-3">
                  <template v-if="c.overall != null">
                    <span class="font-semibold text-highlighted tabular-nums">{{ fmtMark(c.overall) }}</span>
                    <span
                      v-if="c.cefr"
                      class="text-xs text-muted ms-1"
                    >{{ c.cefr }}</span>
                  </template>
                  <span
                    v-else
                    class="text-dimmed"
                  >—</span>
                  <p
                    v-if="c.releasedAt"
                    class="text-[11px] text-success mt-1 inline-flex items-center gap-1"
                  >
                    <UIcon
                      name="i-lucide-check"
                      class="size-3"
                    />{{ t('mocks.announcedBadge') }}
                  </p>
                </td>

                <td class="px-2 py-2.5 text-end">
                  <UDropdownMenu
                    :items="[[
                      ...(c.checkedInAt ? [{ label: t('mocks.newCode'), icon: 'i-lucide-refresh-cw', onSelect: () => checkIn(c) }] : []),
                      ...(c.releasedAt && c.reportToken ? [
                        { label: t('mocks.openReport'), icon: 'i-lucide-file-text', to: `/report/${c.reportToken}`, target: '_blank' },
                        { label: t('mocks.printResult'), icon: 'i-lucide-printer', to: `/report/${c.reportToken}?print=1`, target: '_blank' },
                        { label: t('mocks.copyLink'), icon: 'i-lucide-link', onSelect: () => copyReport(c) }
                      ] : []),
                      ...(c.complete && !c.releasedAt ? [{ label: t('mocks.announceOne'), icon: 'i-lucide-send', onSelect: () => announce([c.id]) }] : []),
                      { label: t('mocks.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(c) }
                    ]]"
                    :content="{ align: 'end' }"
                  >
                    <UButton
                      icon="i-lucide-ellipsis"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('mocks.more')"
                    />
                  </UDropdownMenu>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- The code just given, big, to read out or print -->
    <UModal
      :open="!!codeShown"
      :title="codeShown?.name"
      @update:open="v => !v && (codeShown = null)"
    >
      <template #body>
        <div
          v-if="codeShown"
          class="flex flex-col items-center gap-4 py-4"
        >
          <p class="text-sm text-muted">
            {{ t('mocks.slipSeatCode') }}
          </p>
          <p
            class="font-mono text-5xl font-bold tracking-[0.3em] text-highlighted"
            data-testid="code-shown"
          >
            {{ codeShown.code }}
          </p>
          <p class="text-sm text-muted text-center max-w-sm">
            {{ t('mocks.slipHow') }}
          </p>
          <UButton
            :label="t('mocks.printSlip')"
            icon="i-lucide-printer"
            @click="printCode(codeShown.name, codeShown.code)"
          />
        </div>
      </template>
    </UModal>

    <UModal
      :open="!!walkIn"
      :title="t('mocks.addWalkIn')"
      @update:open="v => !v && (walkIn = null)"
    >
      <template #body>
        <form
          v-if="walkIn"
          class="grid gap-3"
          @submit.prevent="addWalkIn"
        >
          <UFormField
            :label="t('mocks.fullName')"
            required
          >
            <UInput
              v-model="walkIn.fullName"
              class="w-full"
              autofocus
              data-testid="walkin-name"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('mocks.phone')">
              <UInput
                v-model="walkIn.phone"
                type="tel"
                placeholder="+998 90 123 45 67"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('mocks.documentNo')">
              <UInput
                v-model="walkIn.documentNo"
                placeholder="AA1234567"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('mocks.paid')">
              <UInput
                v-model.number="walkIn.paidUzs"
                type="number"
                min="0"
                step="1000"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('mocks.method')">
              <USelect
                v-model="walkIn.paymentMethod"
                :items="[{ label: t('mocks.cash'), value: 'CASH' }, { label: t('mocks.card'), value: 'CARD' }]"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="walkIn = null"
            />
            <UButton
              type="submit"
              :label="t('mocks.add')"
              :loading="busy === 'walkin'"
              :disabled="!walkIn.fullName.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>

    <UModal
      v-model:open="studentsOpen"
      :title="t('mocks.addStudents')"
    >
      <template #body>
        <div class="flex flex-col gap-3">
          <UCheckboxGroup
            v-if="students.length"
            v-model="picked"
            :items="students.map(s => ({ label: s.name || s.email || '—', value: s.id }))"
            class="max-h-80 overflow-y-auto"
          />
          <p
            v-else
            class="text-sm text-muted"
          >
            {{ t('mocks.noStudents') }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="studentsOpen = false"
            />
            <UButton
              :label="t('mocks.addN', { n: picked.length })"
              :disabled="!picked.length"
              :loading="busy === 'students'"
              @click="addStudents"
            />
          </div>
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
