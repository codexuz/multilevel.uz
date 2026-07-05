<script setup lang="ts">
// WYSIWYG HTML editor for passages and rich prompts. Wraps Nuxt UI's UEditor
// (TipTap) and binds an HTML string. No extra dependency — all extensions ship
// with @nuxt/ui.
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'

const model = defineModel<string>({ default: '' })
defineProps<{ placeholder?: string }>()

const extensions = [
  StarterKit,
  Link.configure({ openOnClick: false }),
  Image
]

// Toolbar command groups (icons resolved by UEditorToolbar's built-in handlers).
const toolbar = [
  ['bold', 'italic', 'strike', 'code'],
  ['heading1', 'heading2', 'bulletList', 'orderedList'],
  ['blockquote', 'link', 'horizontalRule'],
  ['undo', 'redo']
]
</script>

<template>
  <UEditor
    v-model="model"
    content-type="html"
    :extensions="extensions"
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
</template>
