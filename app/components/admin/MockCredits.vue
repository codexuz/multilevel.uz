<script setup lang="ts">
/**
 * Mock credits for a centre or a teacher: what is left, and credits sold (or taken back, with a
 * negative number). One credit is spent on each candidate's first check-in at a mock session.
 */
const props = defineProps<{ target: { centreId?: string, userId?: string, name: string } | null }>()
const emit = defineEmits<{ close: [] }>()
const toast = useToast()
const left = ref<number | null>(null)
const credits = ref<number>(10)
const note = ref('')
const saving = ref(false)
const query = computed(() => (props.target?.centreId ? { centreId: props.target.centreId } : { userId: props.target?.userId }))
watch(() => props.target, async (t) => {
  left.value = null
  if (!t) return
  credits.value = 10
  note.value = ''
  left.value = (await $fetch<{ credits: number }>('/api/admin/mock-credits', { query: query.value }).catch(() => ({ credits: 0 }))).credits
}, { immediate: true })
async function save() {
  saving.value = true
  try {
    const res = await $fetch<{ credits: number }>('/api/admin/mock-credits', { method: 'POST', body: { ...query.value, credits: credits.value, note: note.value } })
    toast.add({ title: 'Mock credits saved', description: `${res.credits} left`, color: 'success' })
    emit('close')
  } catch (e) {
    toast.add({ title: 'Not saved', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="!!target"
    :title="`Mock credits · ${target?.name ?? ''}`"
    description="One credit is spent on each candidate's first check-in at a mock session."
    @update:open="v => !v && emit('close')"
  >
    <template #body>
      <form
        class="grid gap-3"
        @submit.prevent="save"
      >
        <p class="text-sm text-muted">
          Left now: <span class="font-semibold text-highlighted">{{ left ?? '…' }}</span>
        </p>
        <div class="grid grid-cols-[8rem_1fr] gap-3">
          <UFormField
            label="Credits"
            help="Negative takes back"
          >
            <UInputNumber
              v-model="credits"
              :step="1"
            />
          </UFormField>
          <UFormField label="Note">
            <UInput
              v-model="note"
              placeholder="Paid 500 000 so'm on Telegram"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          />
          <UButton
            type="submit"
            label="Save"
            :loading="saving"
            :disabled="!credits"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
