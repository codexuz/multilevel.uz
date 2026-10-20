<script setup lang="ts">
// A published test in a list: its title, what it is, its sections and the way in. The title links to
// the test's own page, which search engines index.
defineProps<{ test: { slug: string, title: string, description?: string | null, mode?: string, category?: string | null, source?: string | null, sections: { skill: string, questions?: number, items?: number, durationSeconds?: number | null }[] } }>()
</script>

<template>
  <UCard :ui="{ body: 'flex flex-col gap-3 h-full' }">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <NuxtLink
          :to="`/tests/${test.slug}`"
          class="font-semibold text-highlighted hover:underline line-clamp-2"
        >{{ test.title }}</NuxtLink>
        <p class="text-xs text-muted">
          Multilevel{{ test.category ? ` · ${categoryLabel(test.category)}` : '' }}{{ test.source ? ` · ${test.source}` : '' }}
        </p>
      </div>
      <UBadge
        v-if="test.mode === 'MOCK'"
        label="Mock format"
        color="warning"
        variant="subtle"
      />
    </div>
    <p
      v-if="test.description"
      class="text-sm text-muted line-clamp-3"
    >
      {{ test.description }}
    </p>
    <div class="flex flex-wrap gap-1.5">
      <UBadge
        v-for="s in test.sections"
        :key="s.skill"
        :icon="SKILL_META[s.skill as keyof typeof SKILL_META].icon"
        :label="SKILL_META[s.skill as keyof typeof SKILL_META].label"
        :color="SKILL_META[s.skill as keyof typeof SKILL_META].color"
        variant="soft"
        size="sm"
      />
    </div>
    <UButton
      class="mt-auto self-start"
      :to="`/tests/${test.slug}`"
      label="Open test"
      icon="i-lucide-play"
    />
  </UCard>
</template>
