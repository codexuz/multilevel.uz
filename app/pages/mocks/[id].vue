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
const STATUS_COLOR: Record<Status, 'neutral' | 'info' | 'warning' | 'success' | 'primary'> = { LOCKED: 'neutral', OPEN: 'info', SITTING: 'warning', DONE: 'success', FACE_TO_FACE: 'primary' }
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
    icon="i-lucide-monitor-check"
  >
    <template #actions>
      <UButton
        :href="`/api/mocks/${id}/results.csv`"
        :label="t('mocks.export')"
        icon="i-lucide-sheet"
        color="neutral"
        variant="outline"
      />
    </template>

    <div class="flex flex-col gap-5 w-full">
      <div class="flex flex-wrap items-start gap-3">
        <div class="flex-1 min-w-0">
          <UButton
            to="/mocks"
            :label="t('mocks.title')"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="link"
            class="px-0"
          />
          <p class="text-sm text-muted">
            {{ examLabel(b.test.exam) }} · {{ b.test.title }} · {{ when(b.session.opensAt) }} – {{ when(b.session.closesAt) }}<template v-if="b.session.room">
              · {{ b.session.room }}
            </template><template v-if="b.session.centreName">
              · {{ b.session.centreName }}
            </template>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <USwitch
            :model-value="b.session.holdResults"
            :label="t('mocks.hold')"
            @update:model-value="v => hold(!!v)"
          />
          <UBadge
            :label="t('mocks.credits', { n: b.credits }, b.credits)"
            :color="b.credits ? 'neutral' : 'error'"
            variant="subtle"
          />
          <UButton
            :label="b.session.status === 'ARCHIVED' ? t('mocks.restore') : t('mocks.archive')"
            size="sm"
            color="neutral"
            variant="ghost"
            @click="archive"
          />
          <UButton
            v-if="!started"
            :label="t('mocks.delete')"
            icon="i-lucide-trash-2"
            size="sm"
            color="error"
            variant="ghost"
            :loading="busy === 'delete'"
            data-testid="delete-session"
            @click="removeSession"
          />
        </div>
      </div>

      <!-- The room: sections opened for everyone together -->
      <div class="grid sm:grid-cols-3 gap-3">
        <div
          v-for="skill in online"
          :key="skill"
          class="rounded-xl ring ring-default p-4 flex flex-col gap-2"
          :data-testid="`room-${skill.toLowerCase()}`"
        >
          <div class="flex items-center gap-2">
            <img
              :src="SKILL_ART[skill]"
              alt=""
              class="size-7"
            >
            <span class="font-semibold text-highlighted">{{ skillLabel(skill) }}</span>
          </div>
          <p class="text-xs text-muted">
            {{ t('mocks.roomCounts', { open: openFor(skill), done: doneFor(skill), total: b.summary.total }) }}
          </p>
          <div class="flex gap-2">
            <UButton
              :label="t('mocks.openForRoom')"
              icon="i-lucide-lock-open"
              size="sm"
              :loading="busy === `room-${skill}`"
              :disabled="!b.summary.checkedIn"
              @click="roomOpen(skill, true)"
            />
            <UButton
              v-if="openFor(skill)"
              :label="t('mocks.close')"
              size="sm"
              color="neutral"
              variant="ghost"
              @click="roomOpen(skill, false)"
            />
          </div>
        </div>
      </div>

      <!-- Where things stand -->
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <UBadge
          v-for="[k, v] in [['total', b.summary.total], ['checkedIn', b.summary.checkedIn], ['seated', b.summary.seated], ['sitting', b.summary.sitting], ['complete', b.summary.complete], ['announced', b.summary.announced]]"
          :key="String(k)"
          :label="t(`mocks.sum.${k}`, { n: v })"
          color="neutral"
          variant="soft"
        />
        <UBadge
          v-if="b.summary.paidUzs"
          :label="t('mocks.sum.paid', { sum: fmtUzs(b.summary.paidUzs) })"
          color="success"
          variant="soft"
        />
        <div class="ms-auto flex flex-wrap gap-2">
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
            data-testid="add-walkin"
            @click="startWalkIn"
          />
          <UButton
            :label="t('mocks.announceReady', { n: ready })"
            icon="i-lucide-megaphone"
            size="sm"
            color="success"
            :disabled="!ready"
            :loading="busy === 'release'"
            data-testid="announce"
            @click="announce()"
          />
        </div>
      </div>

      <UEmpty
        v-if="!b.candidates.length"
        icon="i-lucide-users"
        :title="t('mocks.noCandidates')"
        :description="t('mocks.noCandidatesText')"
      />

      <!-- The candidates -->
      <div
        v-else
        class="flex flex-col gap-3"
      >
        <div
          v-for="c in b.candidates"
          :key="c.id"
          class="rounded-xl ring ring-default p-4 flex flex-col gap-3"
          data-testid="candidate"
        >
          <div class="flex flex-wrap items-center gap-2">
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-highlighted truncate">
                {{ c.fullName }}
                <UBadge
                  v-if="c.external"
                  :label="t('mocks.walkIn')"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  class="ms-1"
                />
              </p>
              <p class="text-xs text-muted">
                {{ [c.phone, c.documentNo, c.paidUzs ? `${fmtUzs(c.paidUzs)} (${c.paymentMethod === 'CARD' ? t('mocks.card') : t('mocks.cash')})` : null].filter(Boolean).join(' · ') || '—' }}
              </p>
            </div>
            <!-- Check-in and the seat -->
            <template v-if="!c.checkedInAt">
              <UButton
                :label="t('mocks.checkIn')"
                icon="i-lucide-id-card"
                size="sm"
                :loading="busy === `checkin-${c.id}`"
                data-testid="check-in"
                @click="checkIn(c)"
              />
            </template>
            <template v-else-if="c.seatCode">
              <span
                class="font-mono text-lg font-bold tracking-widest text-highlighted"
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
            </template>
            <UBadge
              v-else-if="c.seatedAt"
              :label="t('mocks.seated')"
              icon="i-lucide-monitor"
              color="success"
              variant="subtle"
            />
            <UDropdownMenu
              :items="[[
                ...(c.checkedInAt ? [{ label: t('mocks.newCode'), icon: 'i-lucide-refresh-cw', onSelect: () => checkIn(c) }] : []),
                ...(c.releasedAt && c.reportToken ? [
                  { label: t('mocks.openReport'), icon: 'i-lucide-file-text', to: `/report/${c.reportToken}`, target: '_blank' },
                  { label: t('mocks.printResult'), icon: 'i-lucide-printer', to: `/report/${c.reportToken}?print=1`, target: '_blank' },
                  { label: t('mocks.copyLink'), icon: 'i-lucide-link', onSelect: () => copyReport(c) }
                ] : []),
                ...(c.complete && !c.releasedAt ? [{ label: t('mocks.announceOne'), icon: 'i-lucide-megaphone', onSelect: () => announce([c.id]) }] : []),
                { label: t('mocks.remove'), icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => remove(c) }
              ]]"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis"
                size="sm"
                color="neutral"
                variant="ghost"
                :aria-label="t('mocks.more')"
              />
            </UDropdownMenu>
          </div>

          <!-- Sections -->
          <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div
              v-for="skill in b.skills"
              :key="skill"
              class="rounded-lg bg-elevated/50 px-3 py-2 flex flex-col gap-1.5"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-highlighted flex-1">{{ skillLabel(skill) }}</span>
                <UBadge
                  :label="t(`mocks.status.${c.sections[skill]?.status ?? 'LOCKED'}`)"
                  :color="STATUS_COLOR[c.sections[skill]?.status ?? 'LOCKED']"
                  variant="subtle"
                  size="sm"
                />
              </div>
              <!-- Listening and Reading: the mark; Writing: the AI's estimate or the mark given; Speaking: given here -->
              <div
                v-if="c.sections[skill]?.status === 'DONE' && skill !== 'WRITING'"
                class="text-sm"
              >
                <span class="font-semibold text-highlighted">{{ fmtMark(c.sections[skill]?.mark) }}</span>
                <span
                  v-if="c.sections[skill]?.total"
                  class="text-muted"
                > · {{ c.sections[skill]?.correct }}/{{ c.sections[skill]?.total }}</span>
              </div>
              <div
                v-else-if="(skill === 'WRITING' && c.sections[skill]?.status === 'DONE') || skill === 'SPEAKING'"
                class="flex items-center gap-2"
              >
                <UInput
                  :model-value="c.sections[skill]?.given ? String(c.sections[skill]?.mark ?? '') : ''"
                  :placeholder="c.sections[skill]?.estimate != null ? t('mocks.aiEstimate', { mark: fmtMark(c.sections[skill]?.estimate) }) : (ielts ? '0–9' : '0–75')"
                  size="xs"
                  class="w-28"
                  :disabled="!!c.releasedAt"
                  :data-testid="`mark-${skill.toLowerCase()}`"
                  @change="(e: Event) => mark(c, skill as 'WRITING' | 'SPEAKING', (e.target as HTMLInputElement).value)"
                />
                <NuxtLink
                  v-if="c.sections[skill]?.attemptId"
                  :to="`/results/${c.sections[skill]?.attemptId}`"
                  target="_blank"
                  class="text-xs text-primary"
                >{{ t('mocks.read') }}</NuxtLink>
              </div>
              <div
                v-else-if="skill !== 'SPEAKING' && c.checkedInAt"
                class="flex gap-1"
              >
                <UButton
                  v-if="c.sections[skill]?.status === 'LOCKED'"
                  :label="t('mocks.openFor')"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  @click="candidateOpen(c, skill, true)"
                />
              </div>
              <!-- What the exam page noticed: live while sitting, kept with the hand-in -->
              <div
                v-if="(c.sections[skill]?.flags?.length) || (c.live?.skill === skill && c.live.flags.length)"
                class="flex flex-wrap gap-1"
              >
                <UBadge
                  v-for="f in [...new Set([...(c.sections[skill]?.flags ?? []), ...(c.live?.skill === skill ? c.live.flags : [])])]"
                  :key="f"
                  :label="flagLabel(f)"
                  color="error"
                  variant="soft"
                  size="sm"
                />
              </div>
              <p
                v-if="c.live?.skill === skill && c.live.signals && (c.live.signals.away || c.live.signals.pastes || c.live.signals.fullscreenExits)"
                class="text-[11px] text-muted"
              >
                {{ t('mocks.seen', { away: c.live.signals.away ?? 0, pastes: c.live.signals.pastes ?? 0, fs: c.live.signals.fullscreenExits ?? 0 }) }}
              </p>
            </div>
          </div>

          <div
            v-if="c.overall != null || c.releasedAt"
            class="flex items-center gap-2 text-sm"
          >
            <span class="text-muted">{{ t('mocks.overall') }}</span>
            <span class="font-bold text-highlighted">{{ fmtMark(c.overall) }}</span>
            <UBadge
              v-if="c.cefr"
              :label="c.cefr"
              color="primary"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="c.releasedAt"
              :label="t('mocks.announcedBadge')"
              icon="i-lucide-check"
              color="success"
              variant="subtle"
              size="sm"
            />
          </div>
        </div>
      </div>
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
