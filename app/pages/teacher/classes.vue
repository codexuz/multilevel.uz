<script setup lang="ts">
import type { LiveLesson } from '~/components/online/Row.vue'

definePageMeta({ middleware: 'teacher', layout: 'teacher' })
const { t } = useI18n()
useSeoMeta({ title: () => t('nav.online'), robots: 'noindex' })

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
    toast.add({ title: t('online.scheduled'), color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('online.notScheduled'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function cancelLesson(lesson: LiveLesson) {
  if (!confirm(t('online.cancelSure', { title: lesson.title }))) return
  try {
    await $fetch(`/api/live-lessons/${lesson.id}`, { method: 'DELETE' })
    toast.add({ title: t('online.cancelledToast'), color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <AppPage
    :title="t('nav.online')"
    icon="i-lucide-calendar-clock"
  >
    <template #actions>
      <UButton
        :label="t('online.schedule')"
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
        :title="t('online.none')"
        :description="t('online.noneText')"
        :actions="activeGroups.length ? [{ label: t('online.schedule'), icon: 'i-lucide-plus', onClick: () => { scheduling = true } }] : [{ label: t('tdash.newClass'), to: '/classes?new=1' }]"
      />
    </div>

    <UModal
      v-model:open="scheduling"
      :title="t('online.schedule')"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="schedule"
        >
          <UFormField :label="t('tp.class')">
            <USelect
              v-model="form.groupId"
              :items="activeGroups.map(g => ({ label: g.name, value: g.id }))"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('tp.lessonTitle')">
            <UInput
              v-model="form.title"
              placeholder="e.g. Unit 4: Reading Matching Headings"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('tp.notes')">
            <UTextarea
              v-model="form.description"
              :rows="2"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField :label="t('online.startsAt')">
              <UInput
                v-model="form.startsAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('online.duration')">
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
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="scheduling = false"
            />
            <UButton
              type="submit"
              :label="t('online.create')"
              :loading="saving"
              :disabled="!connected || !form.title.trim() || !form.groupId"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
