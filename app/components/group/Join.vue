<script setup lang="ts">
/** Joins a group with the code (or link) a teacher gave: it opens the join page, which asks to confirm. */
const { t } = useI18n()
const router = useRouter()
const code = ref('')
function join() {
  // A pasted link (…/join/ABC123) works too.
  const c = code.value.trim().split('/').pop()?.toUpperCase() ?? ''
  if (c) router.push(`/join/${encodeURIComponent(c)}`)
}
</script>

<template>
  <form
    class="flex flex-col sm:flex-row gap-2"
    data-testid="group-join"
    @submit.prevent="join"
  >
    <UInput
      v-model="code"
      :placeholder="t('groups.codePlaceholder')"
      autofocus
      icon="i-lucide-key-round"
      :ui="{ base: 'uppercase font-mono' }"
      class="flex-1"
      :aria-label="t('classes.classCode')"
    />
    <UButton
      type="submit"
      :label="t('classes.join')"
      icon="i-lucide-log-in"
      :disabled="!code.trim()"
    />
  </form>
</template>
