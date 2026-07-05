<script setup lang="ts">
import type { StudentQuestionDto, PartDto } from '~/types/models'

const props = defineProps<{
  parts: PartDto[]
  questions: StudentQuestionDto[]
  getResponse: (id: string) => string | string[] | null | undefined
  getAudio: (id: string) => string | null | undefined
}>()
const emit = defineEmits<{
  response: [id: string, v: string | string[] | null]
  audio: [id: string, v: string | null]
}>()

const current = ref(0)
const part = computed(() => props.parts[current.value])
const passage = computed(() => (part.value?.content as { passage?: string })?.passage)
const partQuestions = computed(() => props.questions.filter(q => q.partId === part.value?.id))

function prev() {
  if (current.value > 0) current.value--
}
function next() {
  if (current.value < props.parts.length - 1) current.value++
}
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-9rem)]">
    <ResizableSplit
      class="flex-1 min-h-0 bg-default rounded-xl border border-default overflow-hidden"
      :initial="50"
      :min="25"
      storage-key="reading-split"
    >
      <template #left>
        <div class="h-full overflow-auto p-5">
          <h2 class="text-base font-bold text-primary mb-2">
            {{ part?.title }}
          </h2>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-if="passage"
            class="prose prose-sm dark:prose-invert max-w-none"
            v-html="passage"
          />
          <p
            v-else
            class="text-sm text-muted"
          >
            No passage for this part.
          </p>
        </div>
      </template>

      <template #right>
        <div class="h-full overflow-auto p-5 space-y-5 border-t lg:border-t-0 lg:border-l border-default">
          <p
            v-if="part?.instructions"
            class="text-sm text-muted whitespace-pre-line"
          >
            {{ part.instructions }}
          </p>
          <div
            v-for="q in partQuestions"
            :id="`q-${q.id}`"
            :key="q.id"
            class="scroll-mt-4"
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
      </template>
    </ResizableSplit>

    <!-- Part navigation -->
    <div class="flex items-center justify-between gap-3 pt-3 shrink-0">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        label="Oldingi"
        :disabled="current === 0"
        @click="prev"
      />
      <span class="text-sm text-muted font-medium">
        {{ part?.title }} · {{ current + 1 }}/{{ parts.length }}
      </span>
      <UButton
        trailing-icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        label="Keyingi"
        :disabled="current === parts.length - 1"
        @click="next"
      />
    </div>
  </div>
</template>
