<script setup lang="ts">
/** A compact language picker: English, O‘zbekcha, Русский. */
withDefaults(defineProps<{ size?: 'xs' | 'sm' | 'md' }>(), { size: 'sm' })
const { locale, languages, choose } = useLanguage()
const { t } = useI18n()
</script>

<template>
  <USelect
    :model-value="locale"
    :items="languages.map(l => ({ label: l.name, value: l.code }))"
    icon="i-lucide-languages"
    :size="size"
    variant="ghost"
    :aria-label="t('lang.label')"
    class="w-auto"
    @update:model-value="v => choose(v as 'en' | 'uz' | 'ru')"
  />
</template>
