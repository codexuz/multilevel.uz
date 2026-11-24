<script setup lang="ts">
import type { LiveLesson } from './Row.vue'

/**
 * A class's online classes for its teacher: the Google connection (which makes the Meet links),
 * scheduling one, and the list with moving and cancelling. Students are told on Telegram.
 */
const props = defineProps<{ groupId: string, next: string }>()
const { t } = useI18n()
const toast = useToast()
const { data, refresh } = await useFetch<{ lessons: LiveLesson[] }>(() => `/api/groups/${props.groupId}/lessons`, { default: () => ({ lessons: [] }) })
const connected = ref(false)

const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const form = ref<{ id?: string, title: string, startsAt: string, durationMinutes: number } | null>(null)
const saving = ref(false)
function startNew() {
  const at = new Date(Date.now() + 864e5)
  at.setMinutes(0, 0, 0)
  form.value = { title: t('online.defaultTitle'), startsAt: local(at), durationMinutes: 60 }
}
function startMove(l: LiveLesson) {
  form.value = { id: l.id, title: l.title, startsAt: local(new Date(l.startsAt)), durationMinutes: l.durationMinutes }
}
async function save() {
  const f = form.value
  if (!f) return
  saving.value = true
  try {
    const body = { title: f.title, startsAt: new Date(f.startsAt).toISOString(), durationMinutes: f.durationMinutes }
    if (f.id) await $fetch(`/api/live-lessons/${f.id}`, { method: 'PATCH', body })
    else await $fetch(`/api/groups/${props.groupId}/lessons`, { method: 'POST', body })
    toast.add({ title: f.id ? t('online.moved') : t('online.scheduled'), description: t('online.toldText'), color: 'success' })
    form.value = null
    await refresh()
  } catch (e) {
    toast.add({ title: t('online.notScheduled'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function cancel(l: LiveLesson) {
  if (!confirm(t('online.cancelSure', { title: l.title }))) return
  try {
    await $fetch(`/api/live-lessons/${l.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <OnlineGoogleConnect
      :next="next"
      @change="c => connected = c"
    />
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm text-muted">
        {{ t('online.panelText') }}
      </p>
      <UButton
        :label="t('online.schedule')"
        icon="i-lucide-plus"
        :disabled="!connected"
        data-testid="schedule-live"
        @click="startNew"
      />
    </div>
    <div
      v-if="data.lessons.length"
      class="rounded-xl ring ring-default divide-y divide-default overflow-hidden"
    >
      <OnlineRow
        v-for="l in data.lessons"
        :key="l.id"
        :lesson="l"
        manage
        @move="startMove(l)"
        @cancel="cancel(l)"
      />
    </div>
    <UEmpty
      v-else
      icon="i-lucide-video"
      :title="t('online.none')"
      :description="t('online.noneText')"
      variant="naked"
    />

    <UModal
      :open="!!form"
      :title="form?.id ? t('online.move') : t('online.schedule')"
      @update:open="v => !v && (form = null)"
    >
      <template #body>
        <form
          v-if="form"
          class="grid gap-4"
          @submit.prevent="save"
        >
          <UFormField :label="t('online.title')">
            <UInput
              v-model="form.title"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              :label="t('online.startsAt')"
              :help="t('online.yourTime')"
            >
              <UInput
                v-model="form.startsAt"
                type="datetime-local"
                class="w-full"
                data-testid="live-starts"
              />
            </UFormField>
            <UFormField :label="t('online.duration')">
              <UInputNumber
                v-model="form.durationMinutes"
                :min="10"
                :max="240"
                :step="5"
                class="w-full"
              />
            </UFormField>
          </div>
          <p class="text-xs text-muted">
            {{ t('online.meetNote') }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="form = null"
            />
            <UButton
              type="submit"
              :label="form.id ? t('online.save') : t('online.create')"
              :loading="saving"
              data-testid="live-save"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
