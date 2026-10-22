<script setup lang="ts">
// A published test as a tile (SmallTalk2Me's course cards): its level, whether it is free, its
// title, what is in it, and an illustration. The whole tile links to the test's page, which search
// engines index.
const props = defineProps<{ test: { slug: string, title: string, description?: string | null, mode?: string, access?: string, category?: string | null, source?: string | null, exam?: string, module?: string, sections: { skill: string, questions?: number, items?: number, durationSeconds?: number | null }[] } }>()

const skills = computed(() => props.test.sections.filter(s => (s.items ?? 1) > 0))
const questions = computed(() => skills.value.reduce((n, s) => n + (s.questions ?? 0), 0))
const { t } = useI18n()
const minutes = computed(() => Math.round(skills.value.reduce((n, s) => n + (s.durationSeconds ?? 0), 0) / 60))
</script>

<template>
  <div class="relative">
    <NuxtLink
      :to="`/tests/${test.slug}`"
      class="group relative flex flex-col gap-2 min-h-44 overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-primary/40"
      :class="tileGradient(test.slug)"
    >
      <div class="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span class="flex items-center gap-1">
          <span class="rounded-sm bg-white/25 px-1.5 py-0.5">{{ examLabel(test.exam, test.module) }}</span>
          <span
            v-if="test.mode === 'MOCK'"
            class="rounded-sm bg-white/15 px-1.5 py-0.5"
          >{{ t('tests.mockExam') }}</span>
        </span>
        <span
          v-if="test.access === 'PREMIUM'"
          class="flex items-center gap-1"
        ><UIcon
          name="i-lucide-sparkles"
          class="size-3"
        /> Premium</span>
        <span
          v-else
          class="text-white/80"
        >{{ t('common.free') }}</span>
      </div>
      <h3 class="relative z-1 max-w-[80%] text-lg font-semibold leading-snug line-clamp-2">
        {{ test.title }}
      </h3>
      <p
        v-if="test.description"
        class="relative z-1 max-w-[72%] text-xs text-white/80 line-clamp-2"
      >
        {{ test.description }}
      </p>
      <div class="relative z-1 mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5 max-w-[70%] text-[11px] text-white/85">
        <span>{{ skills.map(s => skillLabel(s.skill)).join(' · ') }}</span>
        <span v-if="questions">· {{ t('common.questions', { n: questions }, questions) }}</span>
        <span v-if="minutes">· {{ t('common.minutes', { n: minutes }) }}</span>
      </div>
      <img
        :src="tileArt(test.slug)"
        alt=""
        class="pointer-events-none absolute -bottom-2 -right-2 size-20 sm:size-24 drop-shadow-xl transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3"
      >
    </NuxtLink>
  </div>
</template>
