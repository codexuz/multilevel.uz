<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

definePageMeta({ middleware: 'teacher', layout: 'teacher' })
useSeoMeta({ title: 'Online Classes · Teacher Panel', robots: 'noindex' })

const toast = useToast()
const { data, refresh } = await useFetch<{ teaching: LiveLesson[], learning: LiveLesson[] }>('/api/me/live-lessons', {
  default: () => ({ teaching: [], learning: [] })
})
const { data: classesData } = await useFetch<{ classes: Array<{ id: string, name: string, archived: boolean }> }>('/api/classes', {
  default: () => ({ classes: [] })
})

const activeGroups = computed(() => classesData.value.classes.filter(c => !c.archived))
const scheduling = ref(false)
const connected = ref(false)
const saving = ref(false)
const localIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const form = reactive({
  groupId: '',
  title: '',
  description: '',
  startsAt: localIso(new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 3_600_000)),
  durationMinutes: 60
})

watch(activeGroups, (list) => {
  if (!form.groupId && list[0]) form.groupId = list[0].id
}, { immediate: true })

async function schedule() {
  if (!form.groupId || !form.title.trim()) return
  saving.value = true
  try {
    await $fetch(`/api/groups/${form.groupId}/lessons`, {
      method: 'POST',
      body: {
        title: form.title,
        description: form.description || null,
        startsAt: new Date(form.startsAt).toISOString(),
        durationMinutes: form.durationMinutes
      }
    })
    scheduling.value = false
    form.title = ''
    form.description = ''
    toast.add({ title: 'Online class scheduled', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Could not schedule class', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function cancelLesson(lesson: LiveLesson) {
  if (!confirm(`Cancel "${lesson.title}"?`)) return
  try {
    await $fetch(`/api/live-lessons/${lesson.id}`, { method: 'DELETE' })
    toast.add({ title: 'Class cancelled', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Could not cancel', description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    title="Online Classes"
    icon="i-lucide-calendar-clock"
  >
    <template #actions>
      <UButton
        label="Schedule Class"
        icon="i-lucide-plus"
        :disabled="!activeGroups.length"
        @click="scheduling = true"
      />
    </template>

    <div class="flex flex-col gap-4 max-w-4xl">
      <OnlineGoogleConnect
        next="/teacher/classes"
        @change="c => connected = c"
      />

      <UCard
        v-if="data.teaching.length"
        :ui="{ body: 'p-0 divide-y divide-default' }"
      >
        <OnlineRow
          v-for="l in data.teaching"
          :key="l.id"
          :lesson="l"
          manage
          @cancel="cancelLesson(l)"
        />
      </UCard>

      <UEmpty
        v-else
        icon="i-lucide-video"
        title="No online classes scheduled"
        description="Connect Google Calendar above and schedule a Google Meet session for one of your groups."
        :actions="activeGroups.length ? [{ label: 'Schedule Class', icon: 'i-lucide-plus', onClick: () => { scheduling = true } }] : [{ label: 'Create a Group First', to: '/classes' }]"
      />
    </div>

    <UModal
      v-model:open="scheduling"
      title="Schedule Online Class (Google Meet)"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="schedule"
        >
          <UFormField label="Group">
            <USelect
              v-model="form.groupId"
              :items="activeGroups.map(g => ({ label: g.name, value: g.id }))"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Lesson / Topic Title">
            <UInput
              v-model="form.title"
              placeholder="e.g. Unit 4: Reading Matching Headings"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Notes (optional)">
            <UTextarea
              v-model="form.description"
              :rows="2"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Starts at">
              <UInput
                v-model="form.startsAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Duration (min)">
              <UInputNumber
                v-model="form.durationMinutes"
                :min="15"
                :max="240"
                :step="15"
                class="w-full"
              />
            </UFormField>
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="scheduling = false"
            />
            <UButton
              type="submit"
              label="Create Google Meet Class"
              :loading="saving"
              :disabled="!connected || !form.title.trim() || !form.groupId"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
