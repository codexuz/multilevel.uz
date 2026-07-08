<script setup lang="ts">
// Global host for useConfirm(). Mounted once in app.vue.
const state = useConfirmState()

function respond(value: boolean) {
  state.resolve?.(value)
  state.resolve = undefined
  state.open = false
}

// Dismissing via overlay / Escape resolves as "cancel".
watch(() => state.open, (open) => {
  if (!open && state.resolve) {
    state.resolve(false)
    state.resolve = undefined
  }
})
</script>

<template>
  <UModal
    v-model:open="state.open"
    :title="state.title"
    :description="state.description"
    :ui="{ footer: 'justify-end gap-2' }"
  >
    <template #footer>
      <UButton
        :label="state.cancelLabel"
        color="neutral"
        variant="ghost"
        @click="respond(false)"
      />
      <UButton
        :label="state.confirmLabel"
        :color="state.color"
        :icon="state.icon"
        @click="respond(true)"
      />
    </template>
  </UModal>
</template>
