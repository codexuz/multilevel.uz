<script setup lang="ts">
import type { AnswerMap } from '~/types/exam'
import type { QuestionGroup, QuestionItem } from '~/types/ielts'

/**
 * One marked question group, drawn by the test's own question components as it was sat (the marks
 * come from REVIEW_MARKS), then — while the key is shown — why each answer is right and the line in
 * the text it comes from, when that line is not already marked in the passage beside it.
 */
const props = defineProps<{
  group: QuestionGroup
  answers: AnswerMap
  showKey: boolean
  /** Questions whose evidence is already marked in the passage beside the list. */
  evidenceShown?: Set<number>
}>()

const question = computed(() => toRenderQuestion(props.group))
const items = computed(() => sortedItems(props.group))

const explanationOf = (item: QuestionItem) => item.explanation || (items.value.length === 1 ? props.group.explanation : null)
const showEvidence = (item: QuestionItem) => !!item.evidence && !props.evidenceShown?.has(item.number)
const notes = computed(() => (props.showKey ? items.value.filter(i => explanationOf(i) || showEvidence(i)) : []))
</script>

<template>
  <section :data-group="group.id">
    <IxQuestionRenderer :question="question" :answers="answers" disabled />

    <div v-if="notes.length || (showKey && group.explanation && items.length > 1)" class="ix-why">
      <p class="ix-why-title">
        <UIcon name="i-lucide-lightbulb" /> Explanation
      </p>
      <div v-if="showKey && group.explanation && items.length > 1" class="ix-why-text" v-html="group.explanation" />
      <div v-for="item in notes" :key="item.id" class="ix-why-item">
        <strong class="ix-why-num">{{ item.number }}</strong>
        <div class="min-w-0">
          <div v-if="explanationOf(item)" class="ix-why-text" v-html="explanationOf(item)" />
          <p v-if="showEvidence(item)" class="ix-why-quote">
            “{{ stripHtml(item.evidence) }}”
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
