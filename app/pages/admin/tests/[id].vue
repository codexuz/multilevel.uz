<script setup lang="ts">
import { SECTION_META, SECTION_TYPES } from '~/types/exam'
import type { SectionNode } from '~/composables/useTestBuilder'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const route = useRoute()
const testId = route.params.id as string
const builder = useTestBuilder(testId)
const { test, sections, loading } = builder

await builder.load()

const addMenu = computed(() => SECTION_TYPES.map(type => ({
  label: SECTION_META[type].label,
  icon: SECTION_META[type].icon,
  onSelect: () => builder.addSection(type)
})))

const publishing = ref(false)
async function togglePublish() {
  if (!test.value) return
  publishing.value = true
  await builder.saveTestMeta({ status: test.value.status === 'published' ? 'draft' : 'published' })
  publishing.value = false
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        to="/admin/tests"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
      />
      <h1 class="text-2xl font-bold flex-1 truncate">
        {{ test?.title || 'Test' }}
      </h1>
      <UBadge
        :color="test?.status === 'published' ? 'success' : 'neutral'"
        variant="subtle"
        :label="test?.status"
      />
    </div>

    <!-- Test meta -->
    <UCard
      v-if="test"
      :ui="{ body: 'space-y-4' }"
    >
      <div class="grid sm:grid-cols-2 gap-4">
        <UFormField label="Title">
          <UInput
            v-model="test.title"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Level">
          <USelect
            v-model="test.level"
            :items="['A2', 'B1', 'B2', 'C1']"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField label="Description">
        <UTextarea
          v-model="test.description"
          class="w-full"
          :rows="2"
        />
      </UFormField>
      <div class="flex items-center justify-between">
        <UFormField
          label="Premium"
          class="flex items-center gap-3"
        >
          <USwitch v-model="test.is_premium" />
        </UFormField>
        <div class="flex gap-2">
          <UButton
            label="Save details"
            icon="i-lucide-save"
            variant="soft"
            @click="builder.saveTestMeta({ title: test.title, description: test.description, level: test.level, is_premium: test.is_premium })"
          />
          <UButton
            :label="test.status === 'published' ? 'Unpublish' : 'Publish'"
            :icon="test.status === 'published' ? 'i-lucide-eye-off' : 'i-lucide-globe'"
            :color="test.status === 'published' ? 'neutral' : 'primary'"
            :loading="publishing"
            @click="togglePublish"
          />
        </div>
      </div>
    </UCard>

    <!-- Sections -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">
        Sections
      </h2>
      <UDropdownMenu :items="addMenu">
        <UButton
          icon="i-lucide-plus"
          label="Add section"
        />
      </UDropdownMenu>
    </div>

    <div
      v-if="loading"
      class="text-muted"
    >
      Loading…
    </div>

    <UAlert
      v-else-if="!sections.length"
      icon="i-lucide-layers"
      color="neutral"
      variant="subtle"
      title="No sections yet"
      description="Add a Listening, Reading, Writing or Speaking section to begin."
    />

    <UAccordion
      v-else
      type="multiple"
      :items="sections.map((s: SectionNode) => ({ label: s.title, value: s.id, icon: SECTION_META[s.type].icon }))"
    >
      <template #body="{ item }">
        <AdminSectionPanel
          :section="sections.find((s: SectionNode) => s.id === item.value)!"
          @save-section="builder.saveSection"
          @delete-section="builder.deleteSection"
          @add-part="builder.addPart"
          @save-part="builder.savePart"
          @delete-part="builder.deletePart"
          @save-questions="(p, drafts, removed) => builder.saveQuestions(p, drafts, removed)"
        />
      </template>
    </UAccordion>
  </div>
</template>
