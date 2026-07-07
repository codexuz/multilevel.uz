<script setup lang="ts">
// WYSIWYG HTML editor for passages and rich prompts. Wraps Nuxt UI's UEditor
// (TipTap) and binds an HTML string. No extra dependency — all extensions ship
// with @nuxt/ui.
const model = defineModel<string>({ default: '' })
defineProps<{ placeholder?: string }>()

// Toolbar command groups using EditorToolbarItem objects.
const toolbar = [
  [
    { kind: 'mark' as const, mark: 'bold' as const, icon: 'i-lucide-bold' },
    { kind: 'mark' as const, mark: 'italic' as const, icon: 'i-lucide-italic' },
    { kind: 'mark' as const, mark: 'strike' as const, icon: 'i-lucide-strikethrough' },
    { kind: 'mark' as const, mark: 'code' as const, icon: 'i-lucide-code' }
  ],
  [
    { kind: 'heading' as const, level: 1 as const, icon: 'i-lucide-heading-1' },
    { kind: 'heading' as const, level: 2 as const, icon: 'i-lucide-heading-2' },
    { kind: 'bulletList' as const, icon: 'i-lucide-list' },
    { kind: 'orderedList' as const, icon: 'i-lucide-list-ordered' }
  ],
  [
    { kind: 'blockquote' as const, icon: 'i-lucide-text-quote' },
    { kind: 'link' as const, icon: 'i-lucide-link' },
    { kind: 'horizontalRule' as const, icon: 'i-lucide-minus' }
  ],
  [
    { kind: 'undo' as const, icon: 'i-lucide-undo-2' },
    { kind: 'redo' as const, icon: 'i-lucide-redo-2' }
  ]
]
</script>

<template>
  <ClientOnly>
    <UEditor
      v-model="model"
      content-type="html"
      :placeholder="placeholder"
      :editor-props="{ attributes: { class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-32 p-3' } }"
      class="border border-default rounded-lg overflow-hidden bg-default"
    >
      <template #default="{ editor }">
        <UEditorToolbar
          :editor="editor"
          :items="toolbar"
          class="border-b border-default p-1 flex-wrap"
        />
      </template>
    </UEditor>

    <template #fallback>
      <div class="border border-default rounded-lg p-3 min-h-32 text-sm text-muted bg-default">
        Loading editor…
      </div>
    </template>
  </ClientOnly>
</template>
