<script setup lang="ts">
/**
 * The submission page of a section, reached by the ✓ at the end of the bottom bar (or Options → Go
 * to submission page): how much is answered, part by part, and the button that hands the section
 * in. Going back to a part (the bottom bar) leaves it.
 */
const props = defineProps<{
  parts: { label: string, answered: number, total: number, missing?: number[] }[]
  /** "Submit" for the last section, "Next" when another follows. */
  last?: boolean
}>()
const emit = defineEmits<{ submit: [] }>()

const answered = computed(() => props.parts.reduce((s, p) => s + p.answered, 0))
const total = computed(() => props.parts.reduce((s, p) => s + p.total, 0))
const confirmOpen = ref(false)
</script>

<template>
  <div class="ix-submit-wrap" data-testid="submission-page">
    <div class="ix-submit">
      <span>{{ last ? 'Click Submit to hand in your test' : 'Click Next to continue to the next section' }}</span>
      <button type="button" class="ix-black-btn" data-testid="submit-section" @click="confirmOpen = true">
        <UIcon name="i-lucide-send" />{{ last ? 'Submit' : 'Next' }}
      </button>
    </div>
    <hr>
    <div class="ix-submit-summary">
      <p>You have attempted {{ answered }} of {{ total }} {{ total === 1 ? 'question' : 'questions' }}.</p>
      <ul>
        <li v-for="p in parts" :key="p.label">
          <strong>{{ p.label }}</strong>: {{ p.answered }} of {{ p.total }}<template v-if="p.missing?.length">
            — not attempted: {{ p.missing.join(', ') }}
          </template>
        </li>
      </ul>
    </div>

    <UModal v-model:open="confirmOpen" :title="last ? 'Submit test' : 'Finish this section'" :ui="{ content: 'max-w-sm', footer: 'justify-end' }">
      <template #body>
        <p>
          {{ last ? 'Are you sure you want to submit your test? You will not be able to change your answers.' : 'Are you sure you want to finish this section? You will not be able to come back to it.' }}
        </p>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="confirmOpen = false" />
        <UButton :label="last ? 'Submit' : 'Next section'" color="neutral" data-testid="confirm-submit" @click="confirmOpen = false; emit('submit')" />
      </template>
    </UModal>
  </div>
</template>
