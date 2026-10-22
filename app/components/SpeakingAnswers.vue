<script setup lang="ts">
/**
 * A Speaking part with what was recorded for it: Part 1.1 and 1.2 question by question, each
 * with its answer; Part 2 and Part 3 the card and the one long answer. Answers recorded before
 * they were kept one by one (a single recording for the whole part) are shown under the part.
 */
const props = defineProps<{
  part: { id: string, partNumber: number, exam?: string | null, cueCard?: string | null, imageUrl?: string | null, questions?: { id: string, text: string }[] }
  recordings: { partId: string, position?: number, audioUrl: string }[]
  emptyText: string
}>()

const mine = computed(() => props.recordings.filter(r => r.partId === props.part.id))
const byQuestion = computed(() => answeredByQuestion(props.part.partNumber, props.part.exam) && (props.part.questions?.length ?? 0) > 0 && mine.value.length > 1)
const at = (position: number) => mine.value.find(r => (r.position ?? 0) === position)
</script>

<template>
  <div class="flex flex-col gap-3">
    <img
      v-if="part.imageUrl"
      :src="part.imageUrl"
      alt=""
      class="rounded-md max-h-56 self-start border border-default"
    >
    <div
      v-if="part.cueCard"
      class="rich-content text-sm"
      v-html="part.cueCard"
    />
    <ol
      v-if="byQuestion"
      class="flex flex-col gap-3"
    >
      <li
        v-for="(q, i) in part.questions"
        :key="q.id"
        class="flex flex-col gap-1.5"
      >
        <p class="text-sm font-medium text-highlighted">
          {{ i + 1 }}. {{ q.text }}
        </p>
        <audio
          v-if="at(i)"
          :src="at(i)!.audioUrl"
          controls
          class="w-full"
        />
        <p
          v-else
          class="text-xs text-muted"
        >
          {{ emptyText }}
        </p>
      </li>
    </ol>
    <template v-else>
      <ol
        v-if="part.questions?.length"
        class="list-decimal pl-5 text-sm"
      >
        <li
          v-for="q in part.questions"
          :key="q.id"
        >
          {{ q.text }}
        </li>
      </ol>
      <audio
        v-for="r in mine"
        :key="r.position ?? 0"
        :src="r.audioUrl"
        controls
        class="w-full"
      />
      <p
        v-if="!mine.length"
        class="text-sm text-muted"
      >
        {{ emptyText }}
      </p>
    </template>
  </div>
</template>
