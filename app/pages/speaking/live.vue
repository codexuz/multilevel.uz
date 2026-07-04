<script setup lang="ts">
import type { StudentQuestion } from '~/components/QuestionRenderer.vue'

const supabase = useSupabaseClient()
const toast = useToast()
const rtc = useWebRTC()
const { remoteAudio } = rtc

type Phase = 'idle' | 'searching' | 'waiting' | 'in-call'
const phase = ref<Phase>('idle')
const roomId = ref<string | null>(null)

// Conversation topics drawn from any published speaking section
const { data: topics } = await useAsyncData('speaking-topics', async () => {
  const { data } = await supabase
    .from('student_questions')
    .select('*')
    .eq('type', 'speaking_prompt')
    .limit(6)
  return (data as unknown as StudentQuestion[]) ?? []
})

watch(() => rtc.connected.value, (c) => {
  if (c) phase.value = 'in-call'
})

async function findPartner() {
  phase.value = 'searching'
  try {
    const res = await $fetch<{ roomId: string, role: 'caller' | 'callee', matched: boolean }>(
      '/api/speaking/match', { method: 'POST' }
    )
    roomId.value = res.roomId
    phase.value = res.matched ? 'searching' : 'waiting'
    await rtc.start(res.roomId, res.role === 'caller')
  } catch (e) {
    phase.value = 'idle'
    toast.add({ title: 'Could not start matchmaking', description: (e as Error).message, color: 'error' })
  }
}

function leave() {
  rtc.hangup()
  phase.value = 'idle'
  roomId.value = null
}
</script>

<template>
  <UContainer class="py-8 max-w-3xl space-y-6">
    <div class="text-center space-y-2">
      <UIcon
        name="i-lucide-mic"
        class="size-10 text-primary mx-auto"
      />
      <h1 class="text-2xl font-bold">
        Live Speaking Partner
      </h1>
      <p class="text-muted">
        Get randomly matched with another student for a live audio call to practise speaking.
      </p>
    </div>

    <!-- Hidden audio sink for the remote peer -->
    <audio
      ref="remoteAudio"
      autoplay
      class="hidden"
    />

    <UCard>
      <div class="flex flex-col items-center gap-4 py-6">
        <template v-if="phase === 'idle'">
          <UButton
            size="xl"
            icon="i-lucide-radio"
            label="Find a partner"
            @click="findPartner"
          />
        </template>

        <template v-else-if="phase === 'searching' || phase === 'waiting'">
          <UIcon
            name="i-lucide-loader-circle"
            class="size-8 animate-spin text-primary"
          />
          <p class="text-muted">
            {{ phase === 'waiting' ? 'Waiting for a partner to join…' : 'Connecting…' }}
          </p>
          <UButton
            variant="subtle"
            color="neutral"
            label="Cancel"
            @click="leave"
          />
        </template>

        <template v-else>
          <div class="flex items-center gap-2 text-success">
            <span class="size-3 rounded-full bg-success animate-pulse" />
            <span class="font-semibold">Connected</span>
          </div>
          <div class="flex gap-2">
            <UButton
              :icon="rtc.muted.value ? 'i-lucide-mic-off' : 'i-lucide-mic'"
              :color="rtc.muted.value ? 'warning' : 'neutral'"
              variant="soft"
              :label="rtc.muted.value ? 'Unmute' : 'Mute'"
              @click="rtc.toggleMute"
            />
            <UButton
              icon="i-lucide-phone-off"
              color="error"
              label="Leave call"
              @click="leave"
            />
          </div>
        </template>

        <UAlert
          v-if="rtc.error.value"
          color="error"
          variant="subtle"
          :description="rtc.error.value"
          class="mt-2"
        />
      </div>
    </UCard>

    <!-- Talking points -->
    <div
      v-if="topics?.length"
      class="space-y-3"
    >
      <h2 class="font-semibold">
        Conversation topics
      </h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <UCard
          v-for="t in topics"
          :key="t.id"
          :ui="{ body: 'text-sm' }"
        >
          <UBadge
            v-if="t.meta?.taskLabel"
            size="sm"
            variant="subtle"
            color="neutral"
            :label="`Part ${t.meta.taskLabel}`"
            class="mb-1"
          />
          <p>{{ t.prompt }}</p>
        </UCard>
      </div>
    </div>
  </UContainer>
</template>
