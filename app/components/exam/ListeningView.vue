<script setup lang="ts">
import type { StudentQuestionDto, PartDto } from '~/types/models'

const props = defineProps<{
  parts: PartDto[]
  questions: StudentQuestionDto[]
  sectionAudio: string | null
  getResponse: (id: string) => string | string[] | null | undefined
  getAudio: (id: string) => string | null | undefined
  isAnswered: (q: StudentQuestionDto) => boolean
}>()
const emit = defineEmits<{
  response: [id: string, v: string | string[] | null]
  audio: [id: string, v: string | null]
  openNotepad: []
}>()

function questionsForPart(partId: string) {
  return props.questions.filter(q => q.partId === partId)
}

function scrollToQuestion(id: string) {
  document.getElementById(`q-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
defineExpose({ scrollToQuestion })
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="sectionAudio"
      class="sticky top-10 z-10 bg-default border border-default rounded-xl shadow-sm px-4 py-2"
    >
      <audio
        :src="sectionAudio"
        controls
        autoplay
        class="w-full h-9"
      />
    </div>

    <div
      v-for="part in parts"
      :key="part.id"
      class="bg-default rounded-xl border border-default p-5 space-y-4"
    >
      <div>
        <h2 class="text-base font-bold text-primary">
          {{ part.title }}
        </h2>
        <p
          v-if="part.instructions"
          class="text-sm text-muted mt-1 whitespace-pre-line"
        >
          {{ part.instructions }}
        </p>
      </div>

      <UButton
        size="xs"
        color="primary"
        variant="outline"
        icon="i-lucide-notebook-pen"
        label="Blaknot ochish"
        @click="emit('openNotepad')"
      />

      <audio
        v-if="part.audioUrl"
        :src="part.audioUrl"
        controls
        class="w-full h-9"
      />

      <div class="space-y-5">
        <div
          v-for="q in questionsForPart(part.id)"
          :id="`q-${q.id}`"
          :key="q.id"
          class="scroll-mt-32"
        >
          <QuestionRenderer
            :question="q"
            :response="getResponse(q.id)"
            :audio-url="getAudio(q.id)"
            @update:response="emit('response', q.id, $event)"
            @update:audio-url="emit('audio', q.id, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
