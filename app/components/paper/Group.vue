<script setup lang="ts">
import type { QuestionGroup, QuestionItem } from '~/types/ielts'

/**
 * One question group as a printed exam paper sets it (the Multilevel mock papers): plain text, the
 * instruction, a list of headings in a thin box, options as "A) …" with the letter in red, gaps as
 * "(7)__________", multiple choice as the question and its options on lines of their own, True /
 * False / Not Given on one line, and dotted lines to answer matching questions on. Nothing is filled.
 */
const props = defineProps<{ group: QuestionGroup }>()

const type = computed(() => props.group.type)
const items = computed(() => sortedItems(props.group))
const options = computed(() => props.group.content?.options ?? [])
const headings = computed(() => props.group.content?.headings ?? [])
const instruction = computed(() => props.group.instruction?.replace(/<p>\s*<\/p>/g, '').trim() || DEFAULT_INSTRUCTIONS[type.value] || '')

const isTf = computed(() => TFNG_TYPES.includes(type.value))
const isMulti = computed(() => type.value === 'MULTIPLE_ANSWER')
const isChoice = computed(() => type.value === 'MULTIPLE_CHOICE')
const isGap = computed(() => GAP_TYPES.includes(type.value))
const tfChoices = computed(() => (type.value === 'YES_NO_NOT_GIVEN' ? ['Yes', 'No', 'Not Given'] : ['True', 'False', 'Not Given']))

const table = computed(() => (type.value === 'TABLE_COMPLETION' && props.group.content?.table?.headers?.length ? props.group.content.table : null))
const filledTable = computed(() => (table.value ? fillTable(table.value, items.value, false, true) : null))
/** The group's text with its gaps, when the gaps are in it; otherwise each question carries its own. */
const filled = computed(() => (isGap.value && !table.value && gapCount(props.group.context) ? fillGaps(props.group.context!, items.value, false, undefined, true, true) : null))
const loose = computed(() => (table.value ? [] : filled.value ? items.value.filter(i => !filled.value!.placed.has(i.number)) : items.value))
/** The letters to choose from, listed once (matching kinds, a summary with a box of words). */
const optionList = computed(() => (isChoice.value || isMulti.value || isTf.value ? [] : options.value))
const promptOf = (item: QuestionItem) => item.prompt || (items.value.length === 1 ? props.group.context : null)
const range = computed(() => {
  const nums = items.value.map(i => i.number)
  return nums.length > 1 ? `${Math.min(...nums)}–${Math.max(...nums)}` : String(nums[0] ?? '')
})
</script>

<template>
  <div class="paper-group">
    <div
      class="paper-instruction rich-content"
      v-html="instruction"
    />
    <p
      v-if="group.content?.lead"
      class="mt-1"
    >
      {{ group.content.lead }}
    </p>
    <img
      v-if="group.content?.imageUrl"
      :src="mediaUrl(group.content.imageUrl)"
      alt=""
      class="mx-auto my-3 max-h-[95mm] w-auto"
    >

    <!-- List of headings, boxed -->
    <div
      v-if="headings.length"
      class="paper-box mx-auto my-3"
    >
      <p class="paper-red mb-1">
        {{ type === 'MATCHING_HEADINGS' ? 'List of Headings:' : 'Paragraphs:' }}
      </p>
      <p
        v-for="h in headings"
        :key="h.key"
      >
        <span class="paper-red">{{ h.key }})</span> <span
          class="rich-content inline"
          v-html="h.text"
        />
      </p>
    </div>

    <!-- Options to choose from -->
    <div
      v-if="optionList.length"
      class="my-3"
    >
      <p
        v-for="o in optionList"
        :key="o.key"
      >
        <span class="paper-red">{{ o.key }})</span> <span
          class="rich-content inline"
          v-html="o.text"
        />
      </p>
    </div>

    <table
      v-if="table && filledTable"
      class="paper-table my-3"
    >
      <thead>
        <tr>
          <th
            v-for="(h, i) in table.headers"
            :key="i"
          >
            {{ h }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, ri) in filledTable"
          :key="ri"
        >
          <td
            v-for="(cell, ci) in row"
            :key="ci"
            v-html="cell"
          />
        </tr>
      </tbody>
    </table>

    <div
      v-if="filled"
      class="rich-content paper-gaps my-2"
      v-html="filled.html"
    />

    <!-- Choose TWO: the question once, the letters, the question numbers -->
    <div
      v-if="isMulti"
      class="my-2"
    >
      <p>
        <span>{{ range }}.</span> <span
          class="rich-content inline"
          v-html="group.context || items[0]?.prompt || ''"
        />
      </p>
      <p
        v-for="o in options"
        :key="o.key"
        class="ps-5"
      >
        <span class="paper-red">{{ o.key }})</span> <span
          class="rich-content inline"
          v-html="o.text"
        />
      </p>
    </div>

    <!-- The questions one by one -->
    <div
      v-else-if="loose.length"
      class="my-2 space-y-[0.55em]"
    >
      <div
        v-for="item in loose"
        :key="item.id"
        class="break-inside-avoid"
      >
        <!-- A gap in the question's own sentence -->
        <p
          v-if="isGap && gapCount(item.prompt)"
          class="paper-gaps"
        >
          {{ item.number }}. <span
            class="rich-content inline"
            v-html="fillGaps(item.prompt!, [item], false, undefined, false, true).html"
          />
        </p>
        <template v-else>
          <p>
            {{ item.number }}. <span
              v-if="promptOf(item)"
              class="rich-content inline"
              v-html="promptOf(item)"
            /><span
              v-if="!isChoice && !isTf"
              class="paper-dots"
            />
          </p>
          <p
            v-for="o in isChoice ? options : []"
            :key="o.key"
            class="ps-5"
          >
            <span class="paper-red">{{ o.key }})</span> <span
              class="rich-content inline"
              v-html="o.text"
            />
          </p>
          <p
            v-if="isTf"
            class="ps-5"
          >
            <template
              v-for="(c, ci) in tfChoices"
              :key="c"
            >
              <span class="paper-red">{{ String.fromCharCode(65 + ci) }})</span> {{ c }}&nbsp;&nbsp;
            </template>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
