<script setup lang="ts">
import type { SectionNode, PartNode } from '~/composables/useTestBuilder'
import type { EditableQuestion } from './QuestionEditor.vue'

const props = defineProps<{ section: SectionNode }>()
const emit = defineEmits<{
  saveSection: [SectionNode]
  deleteSection: [string]
  addPart: [SectionNode]
  savePart: [PartNode]
  deletePart: [string]
  saveQuestions: [part: PartNode, drafts: EditableQuestion[], removedIds: string[]]
}>()

const isListening = computed(() => props.section.type === 'listening')
const isReading = computed(() => props.section.type === 'reading')
</script>

<template>
  <div class="space-y-4 py-2">
    <div class="grid sm:grid-cols-2 gap-4">
      <UFormField label="Section title">
        <UInput
          v-model="section.title"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Duration (minutes)">
        <UInput
          v-model.number="section.duration_minutes"
          type="number"
          class="w-full"
        />
      </UFormField>
    </div>

    <UFormField
      v-if="isListening"
      label="Section audio"
    >
      <FileUpload
        v-model="section.audio_url"
        purpose="test-audio"
        accept="audio/*"
        preview="audio"
        label="Upload listening audio"
      />
    </UFormField>

    <UFormField
      v-if="isReading"
      label="Video explanation"
    >
      <VideoUpload
        v-model="section.video_explanation_url"
        label="video explanation"
      />
    </UFormField>

    <div class="flex gap-2">
      <UButton
        icon="i-lucide-save"
        size="sm"
        variant="soft"
        label="Save section"
        @click="emit('saveSection', section)"
      />
      <UButton
        icon="i-lucide-trash-2"
        size="sm"
        variant="ghost"
        color="error"
        label="Delete section"
        @click="emit('deleteSection', section.id)"
      />
    </div>

    <USeparator label="Parts" />

    <AdminPartEditor
      v-for="part in section.parts"
      :key="part.id"
      :part="part"
      :section-type="section.type"
      @save-part="emit('savePart', $event)"
      @delete-part="emit('deletePart', $event)"
      @save-questions="(drafts, removed) => emit('saveQuestions', part, drafts, removed)"
    />

    <UButton
      icon="i-lucide-plus"
      variant="outline"
      color="neutral"
      label="Add part"
      @click="emit('addPart', section)"
    />
  </div>
</template>
