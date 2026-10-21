<script setup lang="ts">
/**
 * Learning centres: each buys seats for a time. Its students have Premium while the licence runs;
 * its owner (and the teachers they invite) run groups and set work at /centre.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Learning centres', robots: 'noindex' })

interface Centre {
  id: string
  name: string
  seats: number
  licensedUntil: string | null
  active: boolean
  open: boolean
  students: number
  teachers: number
  groups: number
  owner: string | null
}

const toast = useToast()
const { data: centres, refresh } = await useFetch<Centre[]>('/api/admin/centres', { default: () => [] })

const inAYear = () => new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)
const form = ref<{ id?: string, name: string, owner: string, seats: number, licensedUntil: string } | null>(null)
const saving = ref(false)

function startCreate() {
  form.value = { name: '', owner: '', seats: 30, licensedUntil: inAYear() }
}
function startEdit(c: Centre) {
  form.value = { id: c.id, name: c.name, owner: c.owner ?? '', seats: c.seats, licensedUntil: (c.licensedUntil ?? '').slice(0, 10) || inAYear() }
}
async function save() {
  const f = form.value
  if (!f) return
  saving.value = true
  try {
    const body = { name: f.name, seats: f.seats, licensedUntil: new Date(`${f.licensedUntil}T23:59:59`).toISOString() }
    if (f.id) await $fetch(`/api/admin/centres/${f.id}`, { method: 'PATCH', body })
    else await $fetch('/api/admin/centres', { method: 'POST', body: { ...body, owner: f.owner } })
    toast.add({ title: f.id ? 'Centre saved' : 'Centre opened', description: f.id ? undefined : 'Its owner finds it under My centre.', color: 'success' })
    form.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function toggle(c: Centre) {
  try {
    await $fetch(`/api/admin/centres/${c.id}`, { method: 'PATCH', body: { active: !c.active } })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not changed', description: errorMessage(e), color: 'error' })
  }
}
const state = (c: Centre) => (!c.active
  ? { label: 'Off', color: 'neutral' as const }
  : !c.open ? { label: 'Licence ended', color: 'warning' as const } : { label: 'Active', color: 'success' as const })
</script>

<template>
  <AppPage
    title="Learning centres"
    icon="i-lucide-school"
  >
    <template #actions>
      <UButton
        label="New centre"
        icon="i-lucide-plus"
        @click="startCreate"
      />
    </template>

    <div class="flex flex-col gap-3 max-w-4xl w-full">
      <UEmpty
        v-if="!centres.length"
        icon="i-lucide-school"
        title="No learning centres yet"
        description="Open one for a centre that buys seats: its students get Premium, its teachers get groups, assignments and progress."
        :actions="[{ label: 'New centre', icon: 'i-lucide-plus', onClick: startCreate }]"
      />
      <UCard
        v-for="c in centres"
        :key="c.id"
        :ui="{ body: 'flex flex-col sm:flex-row sm:items-center gap-3' }"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-highlighted">{{ c.name }}</span>
            <UBadge
              :label="state(c).label"
              :color="state(c).color"
              variant="subtle"
              size="sm"
            />
          </div>
          <p class="text-xs text-muted mt-1">
            {{ c.students }} of {{ c.seats }} seats · {{ c.groups }} {{ c.groups === 1 ? 'group' : 'groups' }} · {{ c.teachers }} staff
            · owner {{ c.owner ?? '—' }}
            <template v-if="c.licensedUntil">
              · until {{ formatDate(c.licensedUntil) }}
            </template>
          </p>
          <UProgress
            :model-value="c.seats ? Math.min(100, (c.students / c.seats) * 100) : 0"
            size="xs"
            class="mt-2 max-w-64"
            :color="c.students >= c.seats ? 'warning' : 'primary'"
          />
        </div>
        <div class="flex items-center gap-2">
          <UButton
            label="Edit"
            icon="i-lucide-pencil"
            size="sm"
            color="neutral"
            variant="outline"
            @click="startEdit(c)"
          />
          <USwitch
            :model-value="c.active"
            :aria-label="`${c.name} on`"
            @update:model-value="toggle(c)"
          />
        </div>
      </UCard>
    </div>

    <UModal
      :open="!!form"
      :title="form?.id ? 'Edit centre' : 'New learning centre'"
      @update:open="v => !v && (form = null)"
    >
      <template #body>
        <form
          v-if="form"
          class="grid gap-4"
          @submit.prevent="save"
        >
          <UFormField label="Name">
            <UInput
              v-model="form.name"
              placeholder="e.g. Cambridge Learning Centre, Chilonzor"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="!form.id"
            label="Owner"
            help="Their email or Telegram @username. They need to have signed in once."
          >
            <UInput
              v-model="form.owner"
              placeholder="@username or name@example.com"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="Seats"
              help="Students it covers."
            >
              <UInputNumber
                v-model="form.seats"
                :min="1"
                :max="10000"
              />
            </UFormField>
            <UFormField label="Licence until">
              <UInput
                v-model="form.licensedUntil"
                type="date"
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
              :label="form.id ? 'Save' : 'Open centre'"
              :loading="saving"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
