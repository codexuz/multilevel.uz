<script setup lang="ts">
import type { LiveLesson } from './Row.vue'

/**
 * Schedules an online class or edits one: its title, notes, day, time and length. For a new one the
 * class is fixed (groupId) or picked (groups). Moving it moves its Calendar event and tells the students.
 */
const props = defineProps<{ lesson?: LiveLesson | null, groupId?: string, groups?: { id: string, name: string }[] }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

// Days and times are the site's (Tashkent), as everywhere else on Mockmee.
const dayOf = (d: Date) => siteDay(d)
const timeOf = (d: Date) => siteClock(d)
const LENGTHS = [30, 45, 60, 90, 120]
const form = reactive({ groupId: '', title: '', description: '', day: '', time: '', durationMinutes: 60 })
const saving = ref(false)

watch(open, (o) => {
  if (!o) return
  const l = props.lesson
  if (l) {
    const at = new Date(l.startsAt)
    Object.assign(form, { groupId: '', title: l.title, description: l.description ?? '', day: dayOf(at), time: timeOf(at), durationMinutes: l.durationMinutes })
  } else {
    // Tomorrow, on the hour.
    const at = new Date(Math.ceil((Date.now() + 864e5) / 3_600_000) * 3_600_000)
    Object.assign(form, { groupId: props.groupId ?? props.groups?.[0]?.id ?? '', title: t('online.defaultTitle'), description: '', day: dayOf(at), time: timeOf(at), durationMinutes: 60 })
  }
}, { immediate: true })

const startsAt = computed(() => fromSiteTime(form.day, form.time))
const moved = computed(() => !!props.lesson && !!startsAt.value && startsAt.value.getTime() !== new Date(props.lesson.startsAt).getTime())
const past = computed(() => !!startsAt.value && startsAt.value.getTime() < Date.now() - 5 * 60_000)
const valid = computed(() => !!form.title.trim() && !!startsAt.value && !past.value && (!!props.lesson || !!form.groupId))
const ends = computed(() => (startsAt.value ? timeOf(new Date(startsAt.value.getTime() + form.durationMinutes * 60_000)) : ''))

async function save() {
  if (!valid.value || !startsAt.value) return
  saving.value = true
  const body = { title: form.title, description: form.description || null, startsAt: startsAt.value.toISOString(), durationMinutes: form.durationMinutes }
  try {
    if (props.lesson) await $fetch(`/api/live-lessons/${props.lesson.id}`, { method: 'PATCH', body })
    else await $fetch(`/api/groups/${form.groupId}/lessons`, { method: 'POST', body })
    toast.add({
      title: props.lesson ? (moved.value ? t('online.moved') : t('online.saved')) : t('online.scheduled'),
      description: !props.lesson || moved.value ? t('online.toldText') : undefined,
      color: 'success'
    })
    open.value = false
    emit('saved')
  } catch (e) {
    toast.add({ title: props.lesson ? t('common.notSaved') : t('online.notScheduled'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="lesson ? t('online.edit') : t('online.schedule')"
  >
    <template #body>
      <form
        class="grid gap-4"
        data-testid="live-form"
        @submit.prevent="save"
      >
        <UFormField
          v-if="!lesson && groups?.length"
          :label="t('tp.class')"
          required
        >
          <USelect
            v-model="form.groupId"
            :items="groups.map(g => ({ label: g.name, value: g.id }))"
            class="w-full"
            data-testid="live-group"
          />
        </UFormField>
        <UFormField
          :label="t('online.lessonTitle')"
          required
        >
          <UInput
            v-model="form.title"
            class="w-full"
            data-testid="live-title"
          />
        </UFormField>
        <UFormField :label="t('online.notes')">
          <UTextarea
            v-model="form.description"
            :rows="2"
            autoresize
            :placeholder="t('online.notesPlaceholder')"
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            :label="t('online.day')"
            required
          >
            <UInput
              v-model="form.day"
              type="date"
              :min="dayOf(new Date())"
              class="w-full"
              data-testid="live-day"
            />
          </UFormField>
          <UFormField
            :label="t('online.time')"
            :help="t('online.siteTime')"
            required
          >
            <UInput
              v-model="form.time"
              type="time"
              step="300"
              class="w-full"
              data-testid="live-time"
            />
          </UFormField>
        </div>
        <UFormField :label="t('online.duration')">
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="n in LENGTHS"
              :key="n"
              type="button"
              class="tile px-3 py-1.5 text-sm font-bold cursor-pointer"
              :data-state="form.durationMinutes === n ? 'selected' : undefined"
              @click="form.durationMinutes = n"
            >
              {{ t('online.minutes', { n }) }}
            </button>
            <UInputNumber
              v-model="form.durationMinutes"
              :min="10"
              :max="240"
              :step="5"
              class="w-28"
              :aria-label="t('online.duration')"
            />
          </div>
        </UFormField>
        <p
          v-if="startsAt && !past"
          class="text-sm text-toned flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-calendar-clock"
            class="size-4 text-primary shrink-0"
          />
          {{ localeDate(startsAt, intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) }} – {{ ends }}
        </p>
        <p
          v-else-if="past"
          class="text-sm text-error"
        >
          {{ t('online.inPast') }}
        </p>
        <UAlert
          v-if="moved"
          icon="i-lucide-send"
          color="info"
          variant="subtle"
          :description="t('online.movedNote')"
        />
        <p
          v-else-if="!lesson"
          class="text-xs text-muted"
        >
          {{ t('online.meetNote') }}
        </p>
        <button
          type="submit"
          class="hidden"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          :label="lesson ? t('online.save') : t('online.create')"
          :loading="saving"
          :disabled="!valid"
          data-testid="live-save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
