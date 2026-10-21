<script setup lang="ts">
// One part to practise on its own: its skill and number, title, what it asks, the test it comes
// from, and the way in. Premium parts are marked; their test's page offers Premium or opening it with credits.
const props = defineProps<{ part: { id: string, skill: string, number: number | null, title: string | null, questions: number, types: string[], minWords: number | null, test: { id?: string, slug: string, title: string, access: string } } }>()
const { canOpen } = useMe()

const locked = computed(() => !canOpen(props.part.test))
const to = computed(() => locked.value
  ? `/tests/${props.part.test.slug}`
  : `/tests/${props.part.test.slug}/${props.part.skill.toLowerCase()}?part=${props.part.number}`)
const label = computed(() => `${SKILL_META[props.part.skill as keyof typeof SKILL_META]?.label} · ${partName(props.part.skill, props.part.number)}`)
const title = computed(() => (props.part.title ?? '').replace(/^(Task|Part) [\d.]+\s*[—-]\s*/, '') || label.value)
const asks = computed(() => props.part.questions
  ? `${props.part.questions} questions${props.part.types.length ? ` · ${props.part.types.map(questionTypeLabel).join(', ')}` : ''}`
  : props.part.minWords ? `At least ${props.part.minWords} words` : props.part.skill === 'SPEAKING' ? 'Record your answers' : '')
</script>

<template>
  <NuxtLink
    :to="to"
    class="group flex gap-4 rounded-xl ring ring-default bg-default p-4 transition-colors hover:ring-primary/40 hover:bg-primary/[0.02] focus-visible:outline-3 focus-visible:outline-primary/40"
  >
    <div class="size-12 shrink-0 rounded-xl bg-elevated grid place-items-center">
      <img
        :src="SKILL_ART[part.skill]"
        alt=""
        class="size-7"
      >
    </div>
    <div class="min-w-0 flex-1 flex flex-col gap-1">
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-semibold text-primary">{{ label }}</p>
        <UBadge
          v-if="part.test.access === 'PREMIUM'"
          label="Premium"
          icon="i-lucide-sparkles"
          color="primary"
          variant="soft"
          size="sm"
        />
      </div>
      <p class="font-semibold text-highlighted leading-snug line-clamp-2">{{ title }}</p>
      <p
        v-if="asks"
        class="text-xs text-muted line-clamp-2"
      >{{ asks }}</p>
      <div class="mt-1.5 flex items-center justify-between gap-2">
        <p class="text-xs text-dimmed truncate">From {{ part.test.title }}</p>
        <span class="shrink-0 text-sm font-semibold text-primary flex items-center gap-1 group-hover:gap-1.5 transition-all">
          {{ locked ? 'Unlock' : 'Practise' }}<UIcon
            name="i-lucide-arrow-right"
            class="size-4"
          />
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
