<script setup lang="ts">
/**
 * Mock sessions: a centre (or a Premium teacher) runs a mock on its own computers. Each session is a
 * test, a time and a room; candidates are checked in at the desk and sit at the room's computers
 * with a seat code. One mock credit is spent on each candidate's first check-in.
 */
const { t } = useI18n()
const toast = useToast()
useSeoMeta({ title: () => t('mocks.title'), robots: 'noindex' })

interface Scope { kind: 'CENTRE' | 'TEACHER', centreId: string | null, name: string, credits: number }
interface Row { id: string, title: string, opensAt: string, closesAt: string, room: string | null, status: string, centreId: string | null, centreName: string | null, candidates: number, checkedIn: number, test: { title: string, exam: string } }
const { data } = await useFetch<{ scopes: Scope[], sessions: Row[] }>('/api/mocks', { default: () => ({ scopes: [], sessions: [] }) })
const scopeName = (s: Scope) => (s.kind === 'TEACHER' ? t('mocks.own') : s.name)

const { data: testData } = await useFetch<{ items: { id: string, title: string, module: string }[] }>('/api/tests', { query: { limit: 60 }, default: () => ({ items: [] }) })
const testItems = computed(() => testData.value.items.map(x => ({ label: `${examLabel(examOfModule(x.module))} · ${x.title}`, value: x.id })))

/** Today at 10:00 to 14:00, as datetime-input values. */
function today() {
  const d = new Date()
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { opensAt: `${day}T10:00`, closesAt: `${day}T14:00` }
}
const form = ref<{ centreId: string | null, title: string, testId?: string, opensAt: string, closesAt: string, room: string, capacity?: number, priceUzs?: number, holdResults: boolean } | null>(null)
/** Where a session can be made now: a place with mock credits left (none left, none made). */
const withCredits = computed(() => data.value.scopes.filter(s => s.credits > 0))
const canCreate = computed(() => withCredits.value.length > 0)
function startCreate() {
  if (!canCreate.value) return
  form.value = { centreId: withCredits.value[0]!.centreId, title: t('mocks.defaultTitle'), ...today(), room: '', holdResults: true }
}
const saving = ref(false)
async function save() {
  const f = form.value
  if (!f) return
  saving.value = true
  try {
    const made = await $fetch<{ id: string }>('/api/mocks', {
      method: 'POST',
      body: { ...f, opensAt: new Date(f.opensAt).toISOString(), closesAt: new Date(f.closesAt).toISOString() }
    })
    form.value = null
    await navigateTo(`/mocks/${made.id}`)
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
const when = (d: string) => localeDate(d, intlLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const state = (r: Row) => (r.status === 'ARCHIVED' ? 'archived' : Date.now() > Date.parse(r.closesAt) ? 'closed' : Date.now() >= Date.parse(r.opensAt) ? 'running' : 'upcoming')
const STATE_COLOR = { archived: 'neutral', closed: 'neutral', running: 'success', upcoming: 'info' } as const
</script>

<template>
  <AppPage
    :title="t('mocks.title')"
    icon="i-lucide-monitor-check"
  >
    <template #actions>
      <UButton
        v-if="data.scopes.length"
        :label="t('mocks.new')"
        icon="i-lucide-plus"
        :disabled="!canCreate"
        @click="startCreate"
      />
    </template>

    <div class="flex flex-col gap-5 w-full max-w-4xl">
      <p class="text-muted">
        {{ t('mocks.lead') }}
      </p>

      <!-- Credits, for each place sessions run from: one compact line each, as tall as the button -->
      <div
        v-if="data.scopes.length"
        class="flex flex-wrap items-center gap-2"
      >
        <div
          v-for="s in data.scopes"
          :key="s.centreId ?? 'own'"
          class="h-8 flex items-center gap-1.5 rounded-md ring ring-default px-2.5 text-sm"
          data-testid="credit-chip"
        >
          <UIcon
            :name="s.kind === 'CENTRE' ? 'i-lucide-school' : 'i-lucide-user-round'"
            class="size-4 shrink-0 text-primary"
          />
          <span class="font-medium text-highlighted">{{ scopeName(s) }}</span>
          <span :class="s.credits ? 'text-muted' : 'text-error'">· {{ t('mocks.credits', { n: s.credits }, s.credits) }}</span>
        </div>
        <UButton
          :href="useRuntimeConfig().public.salesTelegram as string"
          target="_blank"
          :label="t('mocks.buyCredits')"
          icon="i-simple-icons-telegram"
          color="neutral"
          variant="outline"
          class="h-8"
        />
      </div>

      <UAlert
        v-else
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('mocks.notYet')"
        :description="t('mocks.notYetText')"
        :actions="[{ label: t('mocks.getPremium'), to: '/pricing', color: 'primary' }]"
      />

      <!-- No credits anywhere: no session can be made until some are bought -->
      <UAlert
        v-if="data.scopes.length && !canCreate"
        color="warning"
        variant="subtle"
        icon="i-lucide-coins"
        :title="t('mocks.noCreditsTitle')"
        :description="t('mocks.noCreditsText')"
        data-testid="no-credits"
      />
      <UEmpty
        v-if="data.scopes.length && !data.sessions.length"
        icon="i-lucide-monitor-check"
        :title="t('mocks.none')"
        :description="canCreate ? t('mocks.noneText') : undefined"
        :actions="canCreate ? [{ label: t('mocks.new'), icon: 'i-lucide-plus', onClick: startCreate }] : []"
      />
      <NuxtLink
        v-for="r in data.sessions"
        :key="r.id"
        :to="`/mocks/${r.id}`"
        class="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl ring ring-default p-4 hover:ring-primary/40"
        data-testid="mock-row"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-highlighted truncate">{{ r.title }}</span>
            <UBadge
              :label="t(`mocks.state.${state(r)}`)"
              :color="STATE_COLOR[state(r)]"
              variant="subtle"
              size="sm"
            />
          </div>
          <p class="text-sm text-muted truncate">
            {{ examLabel(r.test.exam) }} · {{ r.test.title }} · {{ when(r.opensAt) }}<template v-if="r.room">
              · {{ r.room }}
            </template><template v-if="r.centreName">
              · {{ r.centreName }}
            </template>
          </p>
        </div>
        <span class="text-sm text-muted">{{ t('mocks.checkedInOf', { n: r.checkedIn, total: r.candidates }) }}</span>
      </NuxtLink>
    </div>

    <UModal
      :open="!!form"
      :title="t('mocks.new')"
      @update:open="v => !v && (form = null)"
    >
      <template #body>
        <form
          v-if="form"
          class="grid gap-4"
          @submit.prevent="save"
        >
          <UFormField
            v-if="withCredits.length > 1"
            :label="t('mocks.runBy')"
          >
            <USelect
              v-model="form.centreId as any"
              :items="withCredits.map(s => ({ label: `${scopeName(s)} · ${t('mocks.credits', { n: s.credits }, s.credits)}`, value: s.centreId as any }))"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('mocks.sessionTitle')">
            <UInput
              v-model="form.title"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('mocks.test')">
            <USelectMenu
              v-model="form.testId"
              :items="testItems"
              value-key="value"
              :placeholder="t('mocks.pickTest')"
              class="w-full"
            />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField :label="t('mocks.opens')">
              <UInput
                v-model="form.opensAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('mocks.closes')">
              <UInput
                v-model="form.closesAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <UFormField :label="t('mocks.room')">
              <UInput
                v-model="form.room"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('mocks.capacity')">
              <UInput
                v-model.number="form.capacity"
                type="number"
                min="1"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('mocks.price')">
              <UInput
                v-model.number="form.priceUzs"
                type="number"
                min="0"
                step="1000"
                class="w-full"
              />
            </UFormField>
          </div>
          <USwitch
            v-model="form.holdResults"
            :label="t('mocks.hold')"
            :description="t('mocks.holdText')"
          />
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="form = null"
            />
            <UButton
              type="submit"
              :label="t('mocks.create')"
              :loading="saving"
              :disabled="!form.testId || !form.title.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
