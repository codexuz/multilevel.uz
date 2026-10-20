<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'
import TextAlign from '@tiptap/extension-text-align'
import { mediaUrl, uploadFile } from '~/services/http'

const props = withDefaults(defineProps<{
  placeholder?: string
  /** 'full' shows headings, alignment and image upload; 'basic' only inline marks and lists. */
  toolbar?: 'full' | 'basic'
  minHeight?: string
}>(), { toolbar: 'full', minHeight: 'min-h-40' })

const model = defineModel<string>({ default: '' })
const toast = useToast()
const imageFile = ref<File | null>(null)
const uploading = ref(false)
const editorRef = ref<{ editor?: Editor }>()

const extensions = [TextAlign.configure({ types: ['heading', 'paragraph'] })]

const basicItems: EditorToolbarItem[][] = [
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold' } },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic' } },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline' } }
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bullet list' } },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Numbered list' } }
  ],
  [
    { kind: 'undo', icon: 'i-lucide-undo', tooltip: { text: 'Undo' } },
    { kind: 'redo', icon: 'i-lucide-redo', tooltip: { text: 'Redo' } }
  ]
]

const fullItems: EditorToolbarItem[][] = [
  [
    {
      icon: 'i-lucide-heading',
      tooltip: { text: 'Headings' },
      content: { align: 'start' },
      items: [
        { kind: 'paragraph', icon: 'i-lucide-type', label: 'Paragraph' },
        { kind: 'heading', level: 2, icon: 'i-lucide-heading-2', label: 'Heading 2' },
        { kind: 'heading', level: 3, icon: 'i-lucide-heading-3', label: 'Heading 3' },
        { kind: 'heading', level: 4, icon: 'i-lucide-heading-4', label: 'Heading 4' }
      ]
    }
  ],
  [
    ...basicItems[0]!,
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } },
    { kind: 'link', icon: 'i-lucide-link', tooltip: { text: 'Link' } }
  ],
  [
    ...basicItems[1]!,
    { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } }
  ],
  [
    { kind: 'textAlign', align: 'left', icon: 'i-lucide-align-left', tooltip: { text: 'Align left' } },
    { kind: 'textAlign', align: 'center', icon: 'i-lucide-align-center', tooltip: { text: 'Align center' } },
    { kind: 'textAlign', align: 'right', icon: 'i-lucide-align-right', tooltip: { text: 'Align right' } },
    { kind: 'textAlign', align: 'justify', icon: 'i-lucide-align-justify', tooltip: { text: 'Justify' } }
  ],
  [{ slot: 'upload', icon: 'i-lucide-image-up' }],
  basicItems[2]!
]

const items = computed(() => props.toolbar === 'full' ? fullItems : basicItems)

watch(imageFile, async (file) => {
  if (!file) return
  uploading.value = true
  try {
    const url = mediaUrl((await uploadFile(file)).url)
    if (!url) throw new Error('Upload succeeded but no URL returned')
    editorRef.value?.editor?.chain().focus().setImage({ src: url }).run()
  } catch (e) {
    toast.add({ title: 'Image upload failed', description: errorMessage(e), color: 'error' })
  } finally {
    uploading.value = false
    imageFile.value = null
  }
})
</script>

<template>
  <UEditor
    ref="editorRef"
    v-slot="{ editor }"
    v-model="model"
    content-type="html"
    :extensions="extensions"
    :placeholder="placeholder"
    class="w-full rounded-md ring ring-default bg-default"
    :ui="{ base: ['rich-content px-4 py-3', minHeight] }"
  >
    <UEditorToolbar
      :editor="editor"
      :items="items"
      class="border-b border-default px-2 py-1 overflow-x-auto sticky top-0 bg-default z-10"
    >
      <template #upload>
        <UFileUpload
          v-model="imageFile"
          accept="image/*"
          :preview="false"
          class="w-auto"
        >
          <template #default="{ open }">
            <UTooltip text="Upload image">
              <UButton
                icon="i-lucide-image-up"
                color="neutral"
                variant="ghost"
                size="sm"
                :loading="uploading"
                aria-label="Upload image"
                @click="open()"
              />
            </UTooltip>
          </template>
        </UFileUpload>
      </template>
    </UEditorToolbar>
  </UEditor>
</template>
