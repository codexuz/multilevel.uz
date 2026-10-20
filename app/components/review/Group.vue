<script setup lang="ts">
import type { QuestionGroup, QuestionItem } from '~/types/ielts'

/**
 * One marked question group, drawn the way the candidate saw it: the answers back in the gaps,
 * the options with the chosen and the right one marked, and — when the key is shown — the
 * accepted answers, why, and the line in the passage it comes from.
 */
const props = defineProps<{
  group: QuestionGroup
  showKey: boolean
  /** Questions whose evidence is already marked in the passage beside the list. */
  evidenceShown?: Set<number>
}>()

const items = computed(() => sortedItems(props.group))
const type = computed(() => props.group.type)
const range = computed(() => {
  const nums = items.value.map(i => i.number)
  return nums.length ? [Math.min(...nums), Math.max(...nums)] : [props.group.from ?? 0, props.group.to ?? 0]
})
const instruction = computed(() => {
  const own = props.group.instruction?.replace(/<p>\s*<\/p>/g, '').trim()
  return own || null
})

const isTf = computed(() => TFNG_TYPES.includes(type.value))
const isMulti = computed(() => type.value === 'MULTIPLE_ANSWER')
const isSingleChoice = computed(() => type.value === 'MULTIPLE_CHOICE')
const isGap = computed(() => GAP_TYPES.includes(type.value))
const options = computed(() => props.group.content?.options ?? [])
const headings = computed(() => props.group.content?.headings ?? [])

/** Drag-and-drop gaps hold a letter; show its word beside it. */
const gapLabel = computed(() => type.value === 'SUMMARY_COMPLETION_DRAG_DROP' && options.value.length
  ? (key: string) => describeKey(props.group, key).replace(' — ', '. ')
  : undefined)

const table = computed(() => (type.value === 'TABLE_COMPLETION' && props.group.content?.table?.headers?.length ? props.group.content.table : null))
const filledTable = computed(() => (table.value ? fillTable(table.value, items.value, props.showKey) : null))

/** The group's text with the gaps filled, when the gaps are in it; otherwise each item's prompt carries its gap. */
const filled = computed(() => {
  if (!isGap.value || table.value || !gapCount(props.group.context)) return null
  return fillGaps(props.group.context!, items.value, props.showKey, gapLabel.value)
})
const looseItems = computed(() => {
  if (table.value) return []
  if (filled.value) return items.value.filter(i => !filled.value!.placed.has(i.number))
  return items.value
})

/** A list of options to show once above the questions, for the matching kinds. */
const optionBox = computed(() => {
  if (isSingleChoice.value || isMulti.value || isTf.value) return []
  return options.value
})

// "Choose TWO letters": the letters picked across the group's boxes, and the letters that were right.
const picked = computed(() => new Set(items.value.flatMap(i => String(i.answer ?? '').split(',')).map(k => k.trim().toUpperCase()).filter(Boolean)))
const rightKeys = computed(() => new Set(items.value.flatMap(i => i.acceptedAnswers ?? []).map(k => k.trim().toUpperCase())))

function choiceState(key: string, chosen: Set<string>, right: Set<string>) {
  const k = key.trim().toUpperCase()
  const selected = chosen.has(k)
  const correct = right.has(k)
  if (selected) return { selected, tone: correct ? 'success' : 'error', icon: correct ? 'i-lucide-circle-check' : 'i-lucide-circle-x' }
  if (correct && props.showKey) return { selected, tone: 'key', icon: 'i-lucide-circle-check' }
  return { selected, tone: 'none', icon: '' }
}
const toneClass: Record<string, string> = {
  success: 'border-success bg-success/10 text-highlighted font-medium',
  error: 'border-error bg-error/10 text-highlighted font-medium',
  key: 'border-success border-dashed text-success',
  none: 'border-default text-default'
}
const iconClass: Record<string, string> = { success: 'text-success', error: 'text-error', key: 'text-success', none: '' }

const itemChoices = (item: QuestionItem) => new Set([judgementOrKey(item.answer)])
const itemKeys = (item: QuestionItem) => new Set((item.acceptedAnswers ?? []).map(judgementOrKey))
function judgementOrKey(value?: string | null) {
  return isTf.value ? judgement(value) : String(value ?? '').trim().toUpperCase()
}
const tfChoices = computed(() => (type.value === 'YES_NO_NOT_GIVEN' ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN']))

/** A single multiple-choice group asks one question: its prompt is the item's, or the group's text. */
const promptOf = (item: QuestionItem) => item.prompt || (items.value.length === 1 ? props.group.context : null)

const showEvidence = (item: QuestionItem) => props.showKey && !!item.evidence && !props.evidenceShown?.has(item.number)
const explanationOf = (item: QuestionItem) => item.explanation || (items.value.length === 1 ? props.group.explanation : null)
const notes = computed(() => (props.showKey ? items.value.filter(i => explanationOf(i) || showEvidence(i)) : []))
</script>

<template>
  <section class="space-y-3">
    <div>
      <p class="font-semibold text-highlighted">
        <template v-if="range[1] !== range[0]">
          Questions {{ range[0] }}–{{ range[1] }}
        </template>
        <template v-else>
          Question {{ range[0] }}
        </template>
        <span class="ms-2 text-xs font-normal text-muted uppercase tracking-wide">{{ questionTypeLabel(type) }}</span>
      </p>
      <div
        v-if="instruction"
        class="text-sm text-muted rich-content"
        v-html="instruction"
      />
      <p
        v-else
        class="text-sm text-muted"
      >
        {{ DEFAULT_INSTRUCTIONS[type] }}
      </p>
      <p
        v-if="group.content?.lead"
        class="text-sm mt-1"
      >
        {{ group.content.lead }}
      </p>
    </div>

    <img
      v-if="group.content?.imageUrl"
      :src="mediaUrl(group.content.imageUrl)"
      alt=""
      class="max-h-96 rounded-md border border-default"
    >

    <UCard
      v-if="headings.length"
      variant="soft"
      :ui="{ body: 'p-3 sm:p-3 space-y-1 text-sm' }"
    >
      <p class="font-semibold mb-1">
        {{ type === 'MATCHING_HEADINGS' ? 'List of headings' : 'Paragraphs' }}
      </p>
      <p
        v-for="h in headings"
        :key="h.key"
      >
        <strong class="inline-block min-w-8">{{ h.key }}</strong> <span
          class="rich-content inline"
          v-html="h.text"
        />
      </p>
    </UCard>
    <UCard
      v-if="optionBox.length"
      variant="soft"
      :ui="{ body: 'p-3 sm:p-3 space-y-1 text-sm' }"
    >
      <p class="font-semibold mb-1">
        Options
      </p>
      <p
        v-for="o in optionBox"
        :key="o.key"
      >
        <strong class="inline-block min-w-8">{{ o.key }}</strong> <span
          class="rich-content inline"
          v-html="o.text"
        />
      </p>
    </UCard>

    <!-- A table with gaps in its cells -->
    <div
      v-if="table && filledTable"
      class="overflow-x-auto rounded-md border border-default"
    >
      <table class="w-full text-sm">
        <thead class="bg-elevated">
          <tr>
            <th
              v-for="(h, i) in table.headers"
              :key="i"
              class="px-3 py-2 text-left font-semibold border-b border-default"
            >
              {{ h }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ri) in filledTable"
            :key="ri"
            class="border-b border-default last:border-b-0"
          >
            <td
              v-for="(cell, ci) in row"
              :key="ci"
              class="px-3 py-2 align-top leading-8"
              v-html="cell"
            />
          </tr>
        </tbody>
      </table>
    </div>

    <!-- The group's text with the answers in its gaps -->
    <div
      v-if="filled"
      class="rich-content text-sm leading-9"
      v-html="filled.html"
    />

    <!-- Choose TWO: the letters as one list -->
    <template v-if="isMulti">
      <div
        v-if="group.context || items[0]?.prompt"
        class="rich-content text-sm font-medium"
        v-html="group.context || items[0]?.prompt"
      />
      <div class="flex flex-col gap-1.5">
        <div
          v-for="o in options"
          :key="o.key"
          class="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
          :class="toneClass[choiceState(o.key, picked, rightKeys).tone]"
        >
          <span
            class="inline-flex items-center justify-center rounded-full size-6 border text-xs font-semibold shrink-0"
            :class="choiceState(o.key, picked, rightKeys).selected ? 'border-current' : 'border-default'"
          >{{ o.key }}</span>
          <span
            class="flex-1 rich-content"
            v-html="o.text"
          />
          <UIcon
            v-if="choiceState(o.key, picked, rightKeys).icon"
            :name="choiceState(o.key, picked, rightKeys).icon"
            class="size-4 shrink-0"
            :class="iconClass[choiceState(o.key, picked, rightKeys).tone]"
          />
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <UBadge
          v-for="item in items"
          :id="`review-question-${item.number}`"
          :key="item.id"
          :color="itemColor(item)"
          variant="subtle"
          class="scroll-mt-24"
        >
          {{ item.number }} · {{ item.isCorrect ? 'mark earned' : 'no mark' }}
        </UBadge>
      </div>
    </template>

    <!-- Questions one by one -->
    <div
      v-else-if="looseItems.length"
      class="space-y-4"
    >
      <div
        v-for="item in looseItems"
        :id="`review-question-${item.number}`"
        :key="item.id"
        class="flex items-start gap-3 scroll-mt-24"
      >
        <span
          class="inline-flex items-center justify-center rounded-full min-w-7 h-7 px-1.5 text-xs font-bold text-white shrink-0"
          :class="item.isCorrect ? 'bg-success' : answered(item) ? 'bg-error' : 'bg-neutral-400 dark:bg-neutral-600'"
        >{{ item.number }}</span>

        <div class="flex-1 min-w-0 space-y-2">
          <!-- A gap in the item's own sentence -->
          <div
            v-if="isGap && gapCount(item.prompt)"
            class="rich-content text-sm leading-9"
            v-html="fillGaps(item.prompt!, [item], showKey, gapLabel, false).html"
          />
          <template v-else>
            <div
              v-if="promptOf(item)"
              class="rich-content text-sm"
              :class="isSingleChoice ? 'font-medium' : ''"
              v-html="promptOf(item)"
            />

            <!-- Options, the chosen one and the right one marked -->
            <div
              v-if="isSingleChoice && options.length"
              class="flex flex-col gap-1.5"
            >
              <div
                v-for="o in options"
                :key="o.key"
                class="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                :class="toneClass[choiceState(o.key, itemChoices(item), itemKeys(item)).tone]"
              >
                <span
                  class="inline-flex items-center justify-center rounded-full size-6 border text-xs font-semibold shrink-0"
                  :class="choiceState(o.key, itemChoices(item), itemKeys(item)).selected ? 'border-current' : 'border-default'"
                >{{ o.key }}</span>
                <span
                  class="flex-1 rich-content"
                  v-html="o.text"
                />
                <UIcon
                  v-if="choiceState(o.key, itemChoices(item), itemKeys(item)).icon"
                  :name="choiceState(o.key, itemChoices(item), itemKeys(item)).icon"
                  class="size-4 shrink-0"
                  :class="iconClass[choiceState(o.key, itemChoices(item), itemKeys(item)).tone]"
                />
              </div>
            </div>

            <!-- True / False / Not given -->
            <div
              v-else-if="isTf"
              class="flex flex-wrap gap-1.5"
            >
              <span
                v-for="c in tfChoices"
                :key="c"
                class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs tracking-wide"
                :class="toneClass[choiceState(c, itemChoices(item), itemKeys(item)).tone]"
              >
                {{ c }}
                <UIcon
                  v-if="choiceState(c, itemChoices(item), itemKeys(item)).icon"
                  :name="choiceState(c, itemChoices(item), itemKeys(item)).icon"
                  class="size-3.5"
                  :class="iconClass[choiceState(c, itemChoices(item), itemKeys(item)).tone]"
                />
              </span>
            </div>

            <!-- A letter, a heading, or a word typed in -->
            <div
              v-else
              class="space-y-1 text-sm"
            >
              <p class="flex flex-wrap items-center gap-2">
                <span class="text-muted">Your answer:</span>
                <span
                  class="rounded-md border-2 px-2 py-0.5 font-medium"
                  :class="item.isCorrect ? 'border-success bg-success/10' : answered(item) ? 'border-error bg-error/10' : 'border-default text-dimmed italic'"
                >{{ answered(item) ? describeKey(group, item.answer) : 'no answer' }}</span>
                <UIcon
                  :name="item.isCorrect ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                  class="size-4"
                  :class="item.isCorrect ? 'text-success' : 'text-error'"
                />
              </p>
              <p
                v-if="showKey && !item.isCorrect && item.acceptedAnswers?.length"
                class="text-success"
              >
                Correct: <strong>{{ item.acceptedAnswers.map(k => describeKey(group, k)).join(' / ') }}</strong>
              </p>
            </div>
          </template>

          <UAlert
            v-if="showKey && explanationOf(item)"
            icon="i-lucide-lightbulb"
            color="warning"
            variant="subtle"
            title="Explanation"
            :ui="{ description: 'text-xs' }"
          >
            <template #description>
              <div
                class="rich-content"
                v-html="explanationOf(item)"
              />
            </template>
          </UAlert>
          <p
            v-if="showEvidence(item)"
            class="text-xs italic text-toned border-l-2 border-info/60 pl-2"
          >
            “{{ stripHtml(item.evidence) }}”
          </p>
        </div>
      </div>
    </div>

    <!-- Why, for gaps drawn inside the text or the table -->
    <div
      v-if="(filled || table || isMulti) && notes.length"
      class="space-y-2"
    >
      <div
        v-for="item in notes"
        :key="item.id"
        class="flex items-start gap-2 text-xs"
      >
        <UBadge
          :label="String(item.number)"
          :color="itemColor(item)"
          variant="soft"
          size="sm"
          class="shrink-0"
        />
        <div class="space-y-1">
          <div
            v-if="explanationOf(item)"
            class="rich-content text-muted"
            v-html="explanationOf(item)"
          />
          <p
            v-if="showEvidence(item)"
            class="italic text-toned border-l-2 border-info/60 pl-2"
          >
            “{{ stripHtml(item.evidence) }}”
          </p>
        </div>
      </div>
    </div>

    <UAlert
      v-if="showKey && group.explanation && items.length > 1"
      icon="i-lucide-lightbulb"
      color="warning"
      variant="subtle"
      title="Explanation"
    >
      <template #description>
        <div
          class="rich-content text-xs"
          v-html="group.explanation"
        />
      </template>
    </UAlert>
  </section>
</template>
