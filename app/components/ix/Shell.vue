<script setup lang="ts">
/**
 * The frame of a test as the computer-delivered IELTS shows it: the screen itself, the Notes panel
 * beside it (it pushes the screen over rather than covering it) and the Options page over all. The
 * section using it provides the theme and the chrome (useExamSection).
 */
const theme = useIxTheme()!
const chrome = useIxChrome()!
</script>

<template>
  <div class="ix" :class="{ 'is-dark': theme.isDark.value }" :style="theme.style.value" data-testid="exam-shell">
    <div class="ix-main">
      <slot />
    </div>
    <IxNotesPanel v-if="chrome.notesOpen.value" />
    <IxOptionsPage v-if="chrome.optionsOpen.value" />
  </div>
</template>
