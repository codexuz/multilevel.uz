<script setup lang="ts">
import type { Plan } from '~/utils/billing'

/**
 * What is on sale: Premium by time, marking packs, or both in one plan. Changing a plan never
 * rewrites orders already made. Shows how buyers pay: Click when its keys are set, else Telegram.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Plans', robots: 'noindex' })

const toast = useToast()
const config = useRuntimeConfig()
const { data, refresh } = await useFetch<{ plans: Plan[], click: boolean, telegram: string }>('/api/admin/plans')
const site = String(config.public.siteUrl || '').replace(/\/$/, '')

const empty = () => ({ id: '', code: '', name: '', description: '', priceUzs: 0, durationDays: 30, credits: 0, featured: false, active: true, position: (data.value?.plans.length ?? 0) + 1 })
const editing = ref<ReturnType<typeof empty> | null>(null)
const saving = ref(false)

function edit(p?: Plan) {
  editing.value = p ? { ...p, description: p.description ?? '' } : empty()
}
async function save() {
  const p = editing.value
  if (!p) return
  saving.value = true
  try {
    const body = { code: p.code, name: p.name, description: p.description, priceUzs: p.priceUzs, durationDays: p.durationDays, credits: p.credits, featured: p.featured, active: p.active, position: p.position }
    if (p.id) await $fetch(`/api/admin/plans/${p.id}`, { method: 'PATCH', body })
    else await $fetch('/api/admin/plans', { method: 'POST', body })
    toast.add({ title: 'Plan saved', color: 'success' })
    editing.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function toggle(p: Plan) {
  try {
    await $fetch(`/api/admin/plans/${p.id}`, { method: 'PATCH', body: { active: !p.active } })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not changed', description: errorMessage(e), color: 'error' })
  }
}
const contents = (p: Plan) => [durationText(p.durationDays) && `${durationText(p.durationDays)} of Premium`, p.credits && creditsText(p.credits)].filter(Boolean).join(' + ')
</script>

<template>
  <AppPage
    title="Plans"
    icon="i-lucide-tags"
  >
    <template #actions>
      <UButton
        label="New plan"
        icon="i-lucide-plus"
        @click="edit()"
      />
    </template>

    <UAlert
      v-if="data?.click"
      icon="i-lucide-badge-check"
      color="success"
      variant="subtle"
      title="Click is connected"
      :description="`Buyers pay on Click and get their plan at once. Click's Prepare URL: ${site}/api/billing/click/prepare · Complete URL: ${site}/api/billing/click/complete`"
    />
    <UAlert
      v-else
      icon="i-simple-icons-telegram"
      color="info"
      variant="subtle"
      title="Plans are sold on Telegram"
      :description="`Click's keys are not set (CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY), so Buy opens ${data?.telegram}. When a buyer has paid, switch their plan on in Users → Grant.`"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <ul class="divide-y divide-default">
        <li
          v-for="p in data?.plans ?? []"
          :key="p.id"
          class="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
        >
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted flex items-center gap-2 flex-wrap">
              {{ p.name }}
              <UBadge
                v-if="p.featured"
                label="Most popular"
                color="primary"
                variant="soft"
                size="sm"
              />
              <UBadge
                v-if="!p.active"
                label="Off sale"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </p>
            <p class="text-xs text-muted">
              {{ contents(p) }} · <span class="font-mono">{{ p.code }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2 sm:shrink-0">
            <span class="font-semibold tabular-nums text-highlighted me-auto sm:me-2">{{ fmtUzs(p.priceUzs) }}</span>
            <USwitch
              :model-value="p.active"
              aria-label="On sale"
              @update:model-value="toggle(p)"
            />
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              square
              aria-label="Edit"
              @click="edit(p)"
            />
          </div>
        </li>
      </ul>
    </UCard>

    <UModal
      :open="!!editing"
      :title="editing?.id ? 'Edit plan' : 'New plan'"
      @update:open="v => !v && (editing = null)"
    >
      <template #body>
        <div
          v-if="editing"
          class="grid gap-4"
        >
          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="editing.name"
              placeholder="Premium · 1 month"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Description">
            <UTextarea
              v-model="editing.description"
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Price (so'm)"
              required
            >
              <UInputNumber
                v-model="editing.priceUzs"
                :min="1000"
                :step="1000"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Code"
              required
              help="In links; letters and dashes."
            >
              <UInput
                v-model="editing.code"
                :disabled="!!editing.id"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Premium days"
              help="0 for markings only."
            >
              <UInputNumber
                v-model="editing.durationDays"
                :min="0"
                :max="3650"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Marking credits">
              <UInputNumber
                v-model="editing.credits"
                :min="0"
                :max="1000"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3 items-end">
            <UFormField label="Order">
              <UInputNumber
                v-model="editing.position"
                :min="0"
                :max="1000"
                class="w-full"
              />
            </UFormField>
            <div class="flex flex-col gap-2 pb-1">
              <USwitch
                v-model="editing.featured"
                label="Most popular"
              />
              <USwitch
                v-model="editing.active"
                label="On sale"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 w-full">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            block
            class="sm:w-auto"
            @click="editing = null"
          />
          <UButton
            label="Save"
            :loading="saving"
            block
            class="sm:w-auto"
            @click="save"
          />
        </div>
      </template>
    </UModal>
  </AppPage>
</template>
