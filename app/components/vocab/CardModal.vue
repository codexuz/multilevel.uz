<script setup lang="ts">
import type { VocabCard, VocabCardInput } from '~/utils/vocab'

/** Writes one card by hand, or edits one: the word, what it means, an example and translations. */
const props = defineProps<{ deckId: string, card?: VocabCard | null }>()
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const empty = (): VocabCardInput => ({ term: '', partOfSpeech: '', ipa: '', definition: '', example: '', translationUz: '', translationRu: '' })
const form = ref<VocabCardInput>(empty())
const saving = ref(false)
watch(open, (o) => {
  if (o) form.value = props.card ? { ...empty(), ...props.card } : empty()
})
const valid = computed(() => form.value.term.trim() && form.value.definition.trim())

async function save() {
  if (!valid.value) return
  saving.value = true
  const body = { term: form.value.term, partOfSpeech: form.value.partOfSpeech, ipa: form.value.ipa, definition: form.value.definition, example: form.value.example, translationUz: form.value.translationUz, translationRu: form.value.translationRu }
  try {
    if (props.card) {
      await $fetch(`/api/vocab/cards/${props.card.id}`, { method: 'PATCH', body })
    } else {
      const r = await $fetch<{ added: number }>(`/api/vocab/decks/${props.deckId}/cards`, { method: 'POST', body: { cards: [body] } })
      if (!r.added) throw new Error(t('vocab.alreadyInDeck'))
    }
    open.value = false
    emit('saved')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="card ? t('vocab.editCard') : t('vocab.newCard')"
  >
    <template #body>
      <form
        class="grid sm:grid-cols-2 gap-3"
        @submit.prevent="save"
      >
        <UFormField
          :label="t('vocab.term')"
          required
        >
          <UInput
            v-model="form.term"
            class="w-full"
            autofocus
            data-testid="card-term"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField :label="t('vocab.pos')">
            <UInput
              v-model="form.partOfSpeech as string"
              class="w-full"
            />
          </UFormField>
          <UFormField label="IPA">
            <UInput
              v-model="form.ipa as string"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          :label="t('vocab.definition')"
          required
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.definition"
            class="w-full"
            data-testid="card-definition"
          />
        </UFormField>
        <UFormField
          :label="t('vocab.example')"
          class="sm:col-span-2"
        >
          <UTextarea
            v-model="form.example as string"
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('vocab.translationUz')">
          <UInput
            v-model="form.translationUz as string"
            class="w-full"
          />
        </UFormField>
        <UFormField :label="t('vocab.translationRu')">
          <UInput
            v-model="form.translationRu as string"
            class="w-full"
          />
        </UFormField>
        <button
          type="submit"
          class="hidden"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
        <UButton
          :label="t('common.save')"
          :loading="saving"
          :disabled="!valid"
          data-testid="card-save"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
