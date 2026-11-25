<script setup lang="ts">
import type { LiveLesson } from './Row.vue'

/**
 * A class's online classes for its teacher: the Google Meet status, scheduling one, and the coming
 * ones to edit (title, notes, day, time, length) or cancel; the past and cancelled ones below.
 * Students are told on Telegram.
 */
const props = defineProps<{ groupId: string, next: string }>()
const { t } = useI18n()
const { cancelClass } = useOnlineClasses()
const { data, refresh } = await useFetch<{ lessons: LiveLesson[] }>(() => `/api/groups/${props.groupId}/lessons`, { default: () => ({ lessons: [] }) })
const connected = ref(false)

const coming = computed(() => data.value.lessons.filter(l => l.state === 'UPCOMING' || l.state === 'LIVE').sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
const earlier = computed(() => data.value.lessons.filter(l => l.state === 'ENDED' || l.state === 'CANCELLED'))
const showEarlier = ref(false)

const modalOpen = ref(false)
const editing = ref<LiveLesson | null>(null)
function openModal(l: LiveLesson | null) {
  editing.value = l
  modalOpen.value = true
}
async function cancel(l: LiveLesson) {
  if (await cancelClass(l)) await refresh()
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
        @click="openModal(null)"
      />
    </div>
    <div
      v-if="coming.length"
      class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
    >
      <OnlineRow
        v-for="l in coming"
        :key="l.id"
        :lesson="l"
        manage
        @edit="openModal(l)"
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
    <template v-if="earlier.length">
      <UButton
        :label="t('online.earlier', { n: earlier.length })"
        :trailing-icon="showEarlier ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        color="neutral"
        variant="ghost"
        size="sm"
        class="self-start"
        @click="showEarlier = !showEarlier"
      />
      <div
        v-if="showEarlier"
        class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
      >
        <OnlineRow
          v-for="l in earlier"
          :key="l.id"
          :lesson="l"
          manage
        />
      </div>
    </template>

    <OnlineLessonModal
      v-model:open="modalOpen"
      :lesson="editing"
      :group-id="groupId"
      @saved="refresh()"
    />
  </div>
</template>
