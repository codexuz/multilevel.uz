<script setup lang="ts">
import type { StudentQuestionDto, PartDto } from '~/types/models'

const props = defineProps<{
  parts: PartDto[]
  questions: StudentQuestionDto[]
  getResponse: (id: string) => string | string[] | null | undefined
}>()
const emit = defineEmits<{
  response: [id: string, v: string | string[] | null]
}>()

function partOf(id: string) {
  return props.parts.find(p => p.id === id)
}

// One task = one question. Flatten across parts, ordered by part then question.
const tasks = computed(() =>
  [...props.questions].sort((a, b) => {
    const pa = partOf(a.partId)?.orderIndex ?? 0
    const pb = partOf(b.partId)?.orderIndex ?? 0
    return pa - pb || a.orderIndex - b.orderIndex
  })
)

const current = ref(0)
const task = computed(() => tasks.value[current.value])
const taskPart = computed(() => (task.value ? partOf(task.value.partId) : undefined))
const taskLabel = computed(() => {
  const t = task.value
  if (!t) return ''
  return t.meta?.taskLabel ? `Task ${t.meta.taskLabel}` : (taskPart.value?.title || `Task ${current.value + 1}`)
})

function prev() {
  if (current.value > 0) current.value--
}
function next() {
  if (current.value < tasks.value.length - 1) current.value++
}

function textOf(id: string) {
  const v = props.getResponse(id)
  return typeof v === 'string' ? v : ''
}
function wordCount(id: string) {
  const t = textOf(id).trim()
  return t ? t.split(/\s+/).length : 0
}
function isDone(id: string) {
  return !!textOf(id).trim()
}
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-9rem)]">
    <ResizableSplit
      v-if="task"
      class="flex-1 min-h-0 bg-default rounded-xl border border-default overflow-hidden"
      :initial="45"
      :min="25"
      storage-key="writing-split"
    >
      <!-- Prompt / task on the left -->
      <template #left>
        <div class="h-full overflow-auto p-5 space-y-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-primary">
            {{ taskLabel }}
          </p>
          <p
            v-if="taskPart?.instructions"
            class="text-sm text-muted whitespace-pre-line"
          >
            {{ taskPart.instructions }}
          </p>
          <img
            v-if="task.meta?.imageUrl"
            :src="task.meta.imageUrl as string"
            alt="prompt"
            class="max-h-64 rounded-lg border border-default"
          >
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div
            v-if="task.prompt"
            class="prose prose-sm dark:prose-invert max-w-none"
            v-html="task.prompt"
          />
          <p
            v-if="task.meta?.wordLimit"
            class="text-xs text-muted"
          >
            Suggested limit: {{ task.meta.wordLimit }} words
          </p>
        </div>
      </template>

      <!-- Answer textarea on the right -->
      <template #right>
        <div class="h-full overflow-auto p-5 flex flex-col lg:border-l border-default">
          <UTextarea
            :model-value="textOf(task.id)"
            :rows="18"
            class="w-full flex-1"
            :ui="{ base: 'h-full resize-none' }"
            placeholder="Write your answer here…"
            @update:model-value="emit('response', task.id, String($event))"
          />
          <div class="flex justify-between text-xs text-muted pt-2">
            <span>Words: {{ wordCount(task.id) }}</span>
            <span v-if="task.meta?.wordLimit">Limit: {{ task.meta.wordLimit }}</span>
          </div>
        </div>
      </template>
    </ResizableSplit>

    <!-- Task navigation -->
    <div class="flex items-center justify-between gap-3 pt-3 shrink-0">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="outline"
        label="Oldingi"
        :disabled="current === 0"
        @click="prev"
      />

      <div class="flex items-center gap-1.5">
        <button
          v-for="(t, i) in tasks"
          :key="t.id"
          type="button"
          class="size-8 rounded-md text-xs font-semibold flex items-center justify-center border transition-colors"
          :class="i === current
            ? 'bg-primary text-inverted border-primary'
            : isDone(t.id)
              ? 'bg-primary/10 text-primary border-primary/30'
              : 'bg-default text-default border-default hover:border-primary'"
          @click="current = i"
        >
          {{ t.meta?.taskLabel || (i + 1) }}
        </button>
      </div>

      <UButton
        trailing-icon="i-lucide-chevron-right"
        color="neutral"
        variant="outline"
        label="Keyingi"
        :disabled="current === tasks.length - 1"
        @click="next"
      />
    </div>
  </div>
</template>
