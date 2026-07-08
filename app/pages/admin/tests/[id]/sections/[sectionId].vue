<script setup lang="ts">
import { SECTION_META } from '~/types/exam'
import type { SectionNode } from '~/composables/useTestBuilder'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const route = useRoute()
const testId = route.params.id as string
const sectionId = route.params.sectionId as string

const builder = useTestBuilder(testId)
const { test, sections, loading, saving, savedAt } = builder
const ready = ref(false)

const section = computed<SectionNode | undefined>(() => sections.value.find(s => s.id === sectionId))

async function loadSection() {
  ready.value = false
  await builder.load()
  ready.value = true
}

async function onDeleteSection(id: string) {
  await builder.deleteSection(id)
  // If it was actually removed, go back to the test.
  if (!sections.value.find(s => s.id === id)) {
    await navigateTo(`/admin/tests/${testId}`)
  }
}

onMounted(loadSection)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        :to="`/admin/tests/${testId}`"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
      />
      <UIcon
        v-if="section"
        :name="SECTION_META[section.type].icon"
        class="size-6 text-primary"
      />
      <div class="flex-1 min-w-0">
        <h1 class="text-2xl font-bold truncate">
          {{ section?.title || 'Section' }}
        </h1>
        <p class="text-xs text-muted">
          {{ test?.title }}
        </p>
      </div>
      <div class="shrink-0 text-xs text-muted flex items-center gap-1.5">
        <template v-if="saving > 0">
          <UIcon
            name="i-lucide-loader-circle"
            class="animate-spin"
          />
          Saving…
        </template>
        <template v-else-if="savedAt">
          <UIcon
            name="i-lucide-check"
            class="text-success"
          />
          All changes saved
        </template>
      </div>
    </div>

    <div
      v-if="!ready || loading"
      class="text-muted"
    >
      Loading…
    </div>

    <UAlert
      v-else-if="!section"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="subtle"
      title="Section not found"
      :description="`This section does not exist in this test.`"
      :actions="[{ label: 'Back to test', to: `/admin/tests/${testId}`, color: 'neutral' }]"
    />

    <AdminSectionPanel
      v-else
      :section="section"
      @save-section="builder.saveSection"
      @delete-section="onDeleteSection"
      @add-part="builder.addPart"
      @save-part="builder.savePart"
      @delete-part="builder.deletePart"
      @save-questions="(p, drafts, removed) => builder.saveQuestions(p, drafts, removed)"
    />
  </div>
</template>
