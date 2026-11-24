<script setup lang="ts">
/**
 * A short list a teacher writes line by line (what learners will learn, what they need, who it is
 * for): each line editable in place, removable, and moved up or down; a new line is typed at the end
 * and added with Enter.
 */
const props = defineProps<{ placeholder: string, max?: number }>()
const model = defineModel<string[]>({ required: true })
const { t } = useI18n()

const draft = ref('')
const limit = computed(() => props.max ?? 20)
function add() {
  const v = draft.value.trim()
  if (!v || model.value.length >= limit.value) return
  model.value = [...model.value, v]
  draft.value = ''
}
function set(i: number, v: string) {
  model.value = model.value.map((x, j) => (j === i ? v : x))
}
function remove(i: number) {
  model.value = model.value.filter((_, j) => j !== i)
}
function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= model.value.length) return
  const next = [...model.value]
  ;[next[i], next[j]] = [next[j]!, next[i]!]
  model.value = next
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ol
      v-if="model.length"
      class="flex flex-col gap-1.5"
    >
      <li
        v-for="(line, i) in model"
        :key="i"
        class="group flex items-center gap-2"
      >
        <UIcon
          name="i-lucide-check"
          class="size-4 text-primary shrink-0"
        />
        <UInput
          :model-value="line"
          class="flex-1"
          :maxlength="200"
          @update:model-value="v => set(i, String(v))"
        />
        <div class="flex items-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
          <UButton
            icon="i-lucide-chevron-up"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="i === 0"
            :aria-label="t('builder.moveUp')"
            @click="move(i, -1)"
          />
          <UButton
            icon="i-lucide-chevron-down"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="i === model.length - 1"
            :aria-label="t('builder.moveDown')"
            @click="move(i, 1)"
          />
          <UButton
            icon="i-lucide-x"
            size="xs"
            color="neutral"
            variant="ghost"
            :aria-label="t('words.remove')"
            @click="remove(i)"
          />
        </div>
      </li>
    </ol>
    <div
      v-if="model.length < limit"
      class="flex items-center gap-2"
    >
      <UIcon
        name="i-lucide-plus"
        class="size-4 text-dimmed shrink-0"
      />
      <UInput
        v-model="draft"
        :placeholder="placeholder"
        class="flex-1"
        :maxlength="200"
        variant="soft"
        @keydown.enter.prevent="add"
      />
      <UButton
        :label="t('builder.addLine')"
        size="sm"
        color="neutral"
        variant="outline"
        :disabled="!draft.trim()"
        @click="add"
      />
    </div>
  </div>
</template>
