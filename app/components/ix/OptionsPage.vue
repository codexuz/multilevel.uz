<script setup lang="ts">
import type { IxContrast, IxTextSize } from '~/composables/useIxTheme'

/**
 * The Options page of the test, over the whole screen: the way to the submission page, then
 * Contrast and Text size, each on a page of its own. Full screen and leaving the test (for
 * practice at home; a mock-room computer is locked anyway) come after.
 */
const chrome = useIxChrome()!
const theme = useIxTheme()!
const router = useRouter()

const page = ref<'menu' | 'contrast' | 'size'>('menu')
const leaveOpen = ref(false)
const fullscreen = ref(!!document.fullscreenElement)

const contrastItems: { label: string, value: IxContrast }[] = [
  { label: 'Black on white', value: 'black-on-white' },
  { label: 'White on black', value: 'white-on-black' },
  { label: 'Yellow on black', value: 'yellow-on-black' }
]
const sizeItems: { label: string, value: IxTextSize }[] = [
  { label: 'Standard', value: 'standard' },
  { label: 'Large', value: 'large' },
  { label: 'Extra large', value: 'extra-large' }
]

function close() {
  chrome.optionsOpen.value = false
}
function toSubmission() {
  close()
  chrome.submissionOpen.value = true
}
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()
  else document.exitFullscreen?.()
  fullscreen.value = !fullscreen.value
}
function leave() {
  leaveOpen.value = false
  close()
  const to = chrome.leaveTo.value
  if (to) router.push(to)
  else router.back()
}
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (page.value !== 'menu') page.value = 'menu'
  else close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="ix-options-page" role="dialog" aria-modal="true" :aria-label="page === 'menu' ? 'Options' : page === 'contrast' ? 'Contrast' : 'Text size'" data-testid="options-page">
    <button v-if="page !== 'menu'" type="button" class="ix-options-back" aria-label="Back to options" @click="page = 'menu'">
      <UIcon name="i-lucide-arrow-left" />
    </button>
    <button type="button" class="ix-options-close" aria-label="Close options" @click="close">
      <UIcon name="i-lucide-x" />
    </button>

    <template v-if="page === 'menu'">
      <h1>Options</h1>
      <div class="ix-menu is-primary">
        <button type="button" class="ix-menu-item is-primary" @click="toSubmission">
          <UIcon name="i-lucide-send" />
          <span class="ix-menu-label">Go to submission page</span>
          <UIcon name="i-lucide-chevron-right" />
        </button>
      </div>
      <div class="ix-menu">
        <button type="button" class="ix-menu-item" @click="page = 'contrast'">
          <UIcon name="i-lucide-contrast" />
          <span class="ix-menu-label">Contrast</span>
          <UIcon name="i-lucide-chevron-right" />
        </button>
        <button type="button" class="ix-menu-item" @click="page = 'size'">
          <UIcon name="i-lucide-zoom-in" />
          <span class="ix-menu-label">Text size</span>
          <UIcon name="i-lucide-chevron-right" />
        </button>
      </div>
      <div class="ix-menu">
        <button type="button" class="ix-menu-item" @click="toggleFullscreen">
          <UIcon :name="fullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'" />
          <span class="ix-menu-label">{{ fullscreen ? 'Exit full screen' : 'Full screen' }}</span>
        </button>
        <button type="button" class="ix-menu-item" @click="leaveOpen = true">
          <UIcon name="i-lucide-log-out" />
          <span class="ix-menu-label">Leave test</span>
        </button>
      </div>
    </template>

    <template v-else-if="page === 'contrast'">
      <h1>Contrast</h1>
      <div class="ix-menu" role="radiogroup" aria-label="Contrast">
        <button
          v-for="item in contrastItems"
          :key="item.value"
          type="button"
          role="radio"
          :aria-checked="theme.contrast.value === item.value"
          class="ix-menu-item"
          :class="{ 'is-checked': theme.contrast.value === item.value }"
          @click="theme.contrast.value = item.value"
        >
          <UIcon :name="theme.contrast.value === item.value ? 'i-lucide-circle-dot' : 'i-lucide-circle'" />
          <span class="ix-menu-label">{{ item.label }}</span>
        </button>
      </div>
    </template>

    <template v-else>
      <h1>Text size</h1>
      <div class="ix-menu" role="radiogroup" aria-label="Text size">
        <button
          v-for="item in sizeItems"
          :key="item.value"
          type="button"
          role="radio"
          :aria-checked="theme.textSize.value === item.value"
          class="ix-menu-item"
          :class="{ 'is-checked': theme.textSize.value === item.value }"
          @click="theme.textSize.value = item.value"
        >
          <UIcon :name="theme.textSize.value === item.value ? 'i-lucide-circle-dot' : 'i-lucide-circle'" />
          <span class="ix-menu-label">{{ item.label }}</span>
        </button>
      </div>
    </template>

    <UModal v-model:open="leaveOpen" title="Leave test" :ui="{ content: 'max-w-sm', footer: 'justify-end' }">
      <template #body>
        <p>Are you sure you want to leave this test? Your answers so far are kept.</p>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="leaveOpen = false" />
        <UButton label="Leave" color="error" @click="leave" />
      </template>
    </UModal>
  </div>
</template>
