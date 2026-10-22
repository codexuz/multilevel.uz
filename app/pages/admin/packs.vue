<script setup lang="ts">
import type { Pack } from '~/utils/billing'

/**
 * Test packs: sets of tests sold once, each test the buyer's for good. Pick the exam, the tests in
 * order (drafts can wait in a pack; buyers see the published ones), the price and an old price to
 * strike through. A pack someone bought is taken off sale rather than deleted.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Test packs', robots: 'noindex' })

const toast = useToast()
const { data: packs, refresh } = await useFetch<Pack[]>('/api/admin/packs', { default: () => [] })

interface Form { id: string, title: string, slug: string, description: string, exam: Exam, priceUzs: number, oldPriceUzs: number | null, featured: boolean, active: boolean, position: number, testIds: string[] }
const empty = (): Form => ({ id: '', title: '', slug: '', description: '', exam: 'IELTS', priceUzs: 99000, oldPriceUzs: null, featured: false, active: true, position: packs.value.length + 1, testIds: [] })
const form = ref<Form | null>(null)
const saving = ref(false)

function edit(p?: Pack) {
  form.value = p
    ? { id: p.id, title: p.title, slug: p.slug, description: p.description ?? '', exam: p.exam, priceUzs: p.priceUzs, oldPriceUzs: p.oldPriceUzs, featured: p.featured, active: p.active, position: p.position, testIds: p.tests.map(t => t.id) }
    : empty()
}

// The tests that can go in: the pack's exam, newest first.
const { data: testData } = await useFetch<{ items: { id: string, title: string, status: string, module: string }[] }>('/api/admin/tests', { query: { limit: 100 } })
const testItems = computed(() => (testData.value?.items ?? [])
  .filter(t => examOfModule(t.module) === form.value?.exam)
  .map(t => ({ label: `${t.title}${t.status === 'PUBLISHED' ? '' : ` (${t.status.toLowerCase()})`}`, value: t.id, description: examLabel(examOfModule(t.module), t.module) })))
const titleOf = (id: string) => testData.value?.items.find(t => t.id === id)?.title ?? id
watch(() => form.value?.exam, (exam, before) => {
  // Another exam's tests cannot stay.
  if (form.value && before && exam !== before) form.value.testIds = []
})
function move(i: number, by: number) {
  const ids = form.value!.testIds
  const j = i + by
  if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
}

async function save() {
  const f = form.value
  if (!f) return
  saving.value = true
  try {
    const body = { ...f, oldPriceUzs: f.oldPriceUzs || null }
    if (f.id) await $fetch(`/api/admin/packs/${f.id}`, { method: 'PATCH', body })
    else await $fetch('/api/admin/packs', { method: 'POST', body })
    toast.add({ title: 'Pack saved', color: 'success' })
    form.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function toggle(p: Pack) {
  try {
    await $fetch(`/api/admin/packs/${p.id}`, { method: 'PATCH', body: { active: !p.active } })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not changed', description: errorMessage(e), color: 'error' })
  }
}
const { confirm } = useDialogs()
async function remove(p: Pack) {
  if (!await confirm({ title: `Delete “${p.title}”?`, description: 'If anyone bought it, it is taken off sale instead and they keep their tests.', confirmLabel: 'Delete', color: 'error' })) return
  try {
    await $fetch(`/api/admin/packs/${p.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not deleted', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Test packs"
    icon="i-lucide-package"
  >
    <template #actions>
      <UButton
        label="New pack"
        icon="i-lucide-plus"
        @click="edit()"
      />
    </template>

    <div class="flex flex-col gap-3 max-w-4xl w-full">
      <p class="text-sm text-muted">
        A pack is bought once and its tests stay the buyer's for good, with or without Premium. Buyers pay on Click
        (a promo code for every plan works on packs too), or on Telegram: then give it in Users → Grant.
      </p>
      <UEmpty
        v-if="!packs.length"
        icon="i-lucide-package"
        title="No packs yet"
        description="Put several tests together (ten authentic IELTS Academic tests, say) and sell them as one."
        :actions="[{ label: 'New pack', icon: 'i-lucide-plus', onClick: () => edit() }]"
      />
      <UCard
        v-for="p in packs"
        :key="p.id"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-3' }"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-highlighted">{{ p.title }}</span>
            <UBadge
              :label="examLabel(p.exam)"
              color="primary"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="p.featured"
              label="Featured"
              color="warning"
              variant="subtle"
              size="sm"
            />
            <UBadge
              v-if="!p.active"
              label="Off sale"
              color="neutral"
              variant="subtle"
              size="sm"
            />
          </div>
          <p class="text-xs text-muted mt-1">
            {{ fmtUzs(p.priceUzs) }}<template v-if="p.oldPriceUzs">
              (was {{ fmtUzs(p.oldPriceUzs) }})
            </template>
            · {{ p.testCount }} {{ p.testCount === 1 ? 'test' : 'tests' }}
            <template v-if="p.tests.some(t => t.status !== 'PUBLISHED')">
              · {{ p.tests.filter(t => t.status !== 'PUBLISHED').length }} not published yet
            </template>
            · /packs/{{ p.slug }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <USwitch
            :model-value="p.active"
            :aria-label="p.active ? 'On sale' : 'Off sale'"
            @update:model-value="toggle(p)"
          />
          <UButton
            label="Edit"
            icon="i-lucide-pencil"
            size="sm"
            color="neutral"
            variant="outline"
            @click="edit(p)"
          />
          <UButton
            icon="i-lucide-trash-2"
            size="sm"
            color="error"
            variant="ghost"
            aria-label="Delete"
            @click="remove(p)"
          />
        </div>
      </UCard>
    </div>

    <UModal
      :open="!!form"
      :title="form?.id ? 'Edit pack' : 'New pack'"
      :ui="{ content: 'sm:max-w-2xl' }"
      @update:open="v => !v && (form = null)"
    >
      <template #body>
        <form
          v-if="form"
          class="grid gap-4"
          @submit.prevent="save"
        >
          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField label="Title">
              <UInput
                v-model="form.title"
                placeholder="10 authentic IELTS Academic tests"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Address"
              help="Made from the title when left empty"
            >
              <UInput
                v-model="form.slug"
                placeholder="ielts-academic-10"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Description">
            <UTextarea
              v-model="form.description"
              :rows="3"
              autoresize
              class="w-full"
            />
          </UFormField>
          <div class="grid sm:grid-cols-3 gap-3">
            <UFormField label="Exam">
              <USelect
                v-model="form.exam"
                :items="[{ label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel', value: 'MULTILEVEL' }]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Price (so'm)">
              <UInputNumber
                v-model="form.priceUzs"
                :min="1000"
                :step="1000"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Old price"
              help="Struck through beside it"
            >
              <UInputNumber
                v-model="form.oldPriceUzs as number"
                :min="0"
                :step="1000"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField
            label="Tests"
            :help="`${form.testIds.length} in the pack, in this order`"
          >
            <USelectMenu
              v-model="form.testIds"
              :items="testItems"
              value-key="value"
              multiple
              placeholder="Pick the tests"
              class="w-full"
            />
          </UFormField>
          <ol
            v-if="form.testIds.length"
            class="flex flex-col gap-1 rounded-lg ring ring-default p-2"
          >
            <li
              v-for="(id, i) in form.testIds"
              :key="id"
              class="flex items-center gap-2 text-sm"
            >
              <span class="w-6 text-right text-dimmed">{{ i + 1 }}.</span>
              <span class="flex-1 truncate">{{ titleOf(id) }}</span>
              <UButton
                icon="i-lucide-arrow-up"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Up"
                :disabled="i === 0"
                @click="move(i, -1)"
              />
              <UButton
                icon="i-lucide-arrow-down"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Down"
                :disabled="i === form.testIds.length - 1"
                @click="move(i, 1)"
              />
            </li>
          </ol>
          <div class="flex flex-wrap items-center gap-4">
            <USwitch
              v-model="form.featured"
              label="Featured"
            />
            <USwitch
              v-model="form.active"
              label="On sale"
            />
            <UFormField
              label="Place"
              class="w-24"
            >
              <UInputNumber
                v-model="form.position"
                :min="1"
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
              label="Save"
              :loading="saving"
              :disabled="!form.title.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
