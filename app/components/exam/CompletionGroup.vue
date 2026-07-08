<script setup lang="ts">
import type { CompletionGroup } from '~/types/exam'
import type { StudentQuestionDto } from '~/types/models'

const props = defineProps<{
  group: CompletionGroup
  // All questions in the part; blanks are matched to them by questionNumber.
  questions: StudentQuestionDto[]
  getResponse: (id: string) => string | string[] | null | undefined
  currentQuestionId?: string | null
}>()
const emit = defineEmits<{
  response: [id: string, v: string | string[] | null]
}>()

const TOKEN = /\{\{\s*(\d+)\s*\}\}/

type Segment
  = | { type: 'text', text: string }
    | { type: 'gap', n: number }

// Split a string into literal text + {{n}} gap segments.
function toSegments(text: string): Segment[] {
  return text
    .split(/(\{\{\s*\d+\s*\}\})/)
    .map((chunk): Segment | null => {
      const m = TOKEN.exec(chunk)
      if (m) return { type: 'gap', n: Number(m[1]) }
      return chunk ? { type: 'text', text: chunk } : null
    })
    .filter((s): s is Segment => s !== null)
}

const byNumber = computed(() => {
  const map = new Map<number, StudentQuestionDto>()
  for (const q of props.questions) {
    if (q.questionNumber != null) map.set(q.questionNumber, q)
  }
  return map
})

function questionAt(n: number) {
  return byNumber.value.get(n)
}

function responseOf(q?: StudentQuestionDto) {
  if (!q) return ''
  const r = props.getResponse(q.id)
  return typeof r === 'string' ? r : ''
}

function onInput(n: number, v: string) {
  const q = questionAt(n)
  if (q) emit('response', q.id, v)
}

const paragraphSegments = computed(() => toSegments(props.group.template ?? ''))
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="group.heading"
      class="text-sm font-medium text-highlighted"
    >
      {{ group.heading }}
    </p>

    <!-- Paragraph / note / sentence / flow-chart completion -->
    <p
      v-if="group.template"
      class="text-sm leading-9"
    >
      <template
        v-for="(seg, i) in paragraphSegments"
        :key="i"
      >
        <!-- eslint-disable vue/no-v-html -->
        <span
          v-if="seg.type === 'text'"
          v-html="seg.text"
        />
        <!-- eslint-enable vue/no-v-html -->
        <span
          v-else
          :id="questionAt(seg.n) ? `q-${questionAt(seg.n)!.id}` : undefined"
          class="inline-flex items-center gap-1 mx-1 align-middle scroll-mt-24 rounded transition-colors"
          :class="questionAt(seg.n)?.id === currentQuestionId ? 'ring-2 ring-primary/40 p-0.5' : ''"
        >
          <UBadge
            :label="String(seg.n)"
            color="neutral"
            variant="subtle"
            size="sm"
            class="shrink-0"
          />
          <UInput
            :model-value="responseOf(questionAt(seg.n))"
            size="sm"
            class="w-32"
            placeholder="Answer"
            :disabled="!questionAt(seg.n)"
            @update:model-value="onInput(seg.n, String($event))"
          />
        </span>
      </template>
    </p>

    <!-- Table completion -->
    <div
      v-else-if="group.rows"
      class="overflow-x-auto"
    >
      <table class="w-full border-collapse text-sm">
        <thead v-if="group.columns">
          <tr>
            <th
              v-for="(col, ci) in group.columns"
              :key="ci"
              class="border border-default bg-elevated px-3 py-2 text-left font-semibold"
            >
              {{ col }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ri) in group.rows"
            :key="ri"
          >
            <td
              v-for="(cell, ci) in row"
              :key="ci"
              class="border border-default px-3 py-2 align-middle"
            >
              <template
                v-for="(seg, i) in toSegments(cell)"
                :key="i"
              >
                <!-- eslint-disable vue/no-v-html -->
                <span
                  v-if="seg.type === 'text'"
                  v-html="seg.text"
                />
                <!-- eslint-enable vue/no-v-html -->
                <span
                  v-else
                  :id="questionAt(seg.n) ? `q-${questionAt(seg.n)!.id}` : undefined"
                  class="inline-flex items-center gap-1 align-middle scroll-mt-24"
                >
                  <UBadge
                    :label="String(seg.n)"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    class="shrink-0"
                  />
                  <UInput
                    :model-value="responseOf(questionAt(seg.n))"
                    size="sm"
                    class="w-28"
                    placeholder="Answer"
                    :disabled="!questionAt(seg.n)"
                    @update:model-value="onInput(seg.n, String($event))"
                  />
                </span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
