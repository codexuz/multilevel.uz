<script setup lang="ts">
import type { Pack } from '~/utils/billing'

/**
 * Promo codes: a percentage or an amount off test packs. Each can be limited to some packs, a
 * number of uses and an end date; each user uses a code once. A code's link (a pack's page with
 * ?promo=CODE) applies it. Old days-of-Premium codes no longer work (Premium is not sold).
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Promo codes', robots: 'noindex' })

interface Promo {
  id: string
  code: string
  kind: 'PERCENT' | 'AMOUNT' | 'DAYS'
  value: number
  planCodes: string[]
  maxUses: number | null
  uses: number
  endsAt: string | null
  active: boolean
  note: string | null
  createdAt: string
  text: string
  revenueUzs: number
  discountUzs: number
}

const toast = useToast()
const config = useRuntimeConfig()
const site = String(config.public.siteUrl || '').replace(/\/$/, '')
const { data: promos, refresh } = await useFetch<Promo[]>('/api/admin/promos', { default: () => [] })
const { data: packData } = await useFetch<Pack[]>('/api/admin/packs', { default: () => [] })
// A code for some packs only names them as "pack:<address>".
const planItems = computed(() => packData.value.map(p => ({ label: p.title, value: `pack:${p.slug}` })))

const KINDS = [
  { label: 'Percent off', value: 'PERCENT', icon: 'i-lucide-percent' },
  { label: 'So\'m off', value: 'AMOUNT', icon: 'i-lucide-banknote' }
]
const randomCode = () => Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
const empty = () => ({ code: randomCode(), kind: 'PERCENT' as Promo['kind'], value: 20, planCodes: [] as string[], maxUses: null as number | null, endsAt: '', note: '' })
const creating = ref<ReturnType<typeof empty> | null>(null)
const saving = ref(false)

async function create() {
  const c = creating.value
  if (!c) return
  saving.value = true
  try {
    await $fetch('/api/admin/promos', { method: 'POST', body: { ...c, endsAt: c.endsAt ? new Date(`${c.endsAt}T23:59:59`).toISOString() : null } })
    toast.add({ title: 'Promo code created', description: c.code.toUpperCase(), color: 'success' })
    creating.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not created', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function toggle(p: Promo) {
  try {
    await $fetch(`/api/admin/promos/${p.id}`, { method: 'PATCH', body: { active: !p.active } })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not changed', description: errorMessage(e), color: 'error' })
  }
}
async function copyLink(p: Promo) {
  try {
    // The code's first pack (or the catalogue's packs, for every pack).
    const pack = p.planCodes.find(c => c.startsWith('pack:'))?.slice(5)
    const link = pack ? `${site}/packs/${pack}?promo=${p.code}` : `${site}/tests?view=packs&promo=${p.code}`
    await navigator.clipboard.writeText(link)
    toast.add({ title: 'Link copied', description: link, color: 'success' })
  } catch {}
}
const state = (p: Promo) => (!p.active
  ? { label: 'Off', color: 'neutral' as const }
  : p.endsAt && new Date(p.endsAt) < new Date()
    ? { label: 'Expired', color: 'warning' as const }
    : p.maxUses != null && p.uses >= p.maxUses
      ? { label: 'Used up', color: 'warning' as const }
      : { label: 'Active', color: 'success' as const })
const planNames = (codes: string[]) => (codes.length ? codes.map(c => planItems.value.find(p => p.value === c)?.label ?? c).join(', ') : 'Every pack')
</script>

<template>
  <AppPage
    title="Promo codes"
    icon="i-lucide-ticket-percent"
  >
    <template #actions>
      <UButton
        label="New code"
        icon="i-lucide-plus"
        @click="creating = empty()"
      />
    </template>

    <div class="flex flex-col gap-4 max-w-4xl w-full">
      <UEmpty
        v-if="!promos.length"
        icon="i-lucide-ticket-percent"
        title="No promo codes yet"
        description="Make one for the Telegram channel, a learning centre or people whose Premium ended."
        :actions="[{ label: 'New code', icon: 'i-lucide-plus', onClick: () => { creating = empty() } }]"
      />
      <UCard
        v-for="p in promos"
        :key="p.id"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-3' }"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-mono font-semibold text-highlighted">{{ p.code }}</span>
            <UBadge
              :label="state(p).label"
              :color="state(p).color"
              variant="subtle"
              size="sm"
            />
            <span class="text-sm text-toned">{{ p.text }}</span>
          </div>
          <p class="text-xs text-muted mt-1">
            {{ p.kind === 'DAYS' ? 'Days of Premium (no longer valid)' : planNames(p.planCodes) }}
            · used {{ p.uses }}{{ p.maxUses != null ? ` of ${p.maxUses}` : '' }}
            <template v-if="p.endsAt">
              · until {{ formatDate(p.endsAt) }}
            </template>
            <template v-if="p.revenueUzs || p.discountUzs">
              · brought {{ fmtUzs(p.revenueUzs) }} ({{ fmtUzs(p.discountUzs) }} off)
            </template>
          </p>
          <p
            v-if="p.note"
            class="text-xs text-dimmed mt-0.5"
          >
            {{ p.note }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            label="Copy link"
            icon="i-lucide-link"
            size="sm"
            color="neutral"
            variant="outline"
            @click="copyLink(p)"
          />
          <USwitch
            :model-value="p.active"
            :aria-label="`${p.code} on`"
            @update:model-value="toggle(p)"
          />
        </div>
      </UCard>
    </div>

    <UModal
      :open="!!creating"
      title="New promo code"
      @update:open="v => !v && (creating = null)"
    >
      <template #body>
        <form
          v-if="creating"
          class="grid gap-4"
          @submit.prevent="create"
        >
          <UFormField
            label="Code"
            help="Letters and digits; people type it in any case."
          >
            <div class="flex gap-2">
              <UInput
                v-model="creating.code"
                class="flex-1"
                :ui="{ base: 'uppercase font-mono' }"
              />
              <UButton
                icon="i-lucide-shuffle"
                color="neutral"
                variant="outline"
                aria-label="Make a random code"
                @click="creating.code = randomCode()"
              />
            </div>
          </UFormField>
          <UFormField label="It gives">
            <USelect
              v-model="creating.kind"
              :items="KINDS"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="creating.kind === 'PERCENT' ? 'Percent off' : 'So\'m off'">
            <UInputNumber
              v-model="creating.value"
              :min="1"
              :max="creating.kind === 'PERCENT' ? 100 : undefined"
              :step="creating.kind === 'AMOUNT' ? 1000 : 1"
              class="w-48"
            />
          </UFormField>
          <UFormField
            label="Packs"
            help="Leave empty for every pack."
          >
            <USelectMenu
              v-model="creating.planCodes"
              :items="planItems"
              value-key="value"
              multiple
              placeholder="Every pack"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Most uses"
              help="Empty: no limit."
            >
              <UInputNumber
                v-model="creating.maxUses"
                :min="1"
                placeholder="No limit"
              />
            </UFormField>
            <UFormField
              label="Last day"
              help="Empty: no end."
            >
              <UInput
                v-model="creating.endsAt"
                type="date"
              />
            </UFormField>
          </div>
          <UFormField label="Note (only admins see it)">
            <UInput
              v-model="creating.note"
              placeholder="e.g. Telegram channel, October"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="creating = null"
            />
            <UButton
              type="submit"
              label="Create"
              :loading="saving"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
