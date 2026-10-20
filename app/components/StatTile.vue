<script setup lang="ts">
const props = defineProps<{
  label: string
  value?: string | number | null
  icon: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'neutral'
  hint?: string
  loading?: boolean
}>()

const tones = {
  primary: { root: 'bg-primary/10', icon: 'text-primary' },
  success: { root: 'bg-success/10', icon: 'text-success' },
  warning: { root: 'bg-warning/10', icon: 'text-warning' },
  error: { root: 'bg-error/10', icon: 'text-error' },
  info: { root: 'bg-info/10', icon: 'text-info' },
  secondary: { root: 'bg-secondary/10', icon: 'text-secondary' },
  neutral: { root: 'bg-elevated', icon: 'text-muted' }
}
</script>

<template>
  <UCard
    variant="subtle"
    :ui="{ body: 'p-4 sm:p-5' }"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <p class="text-sm text-muted truncate">
          {{ label }}
        </p>
        <USkeleton
          v-if="loading"
          class="h-8 w-16"
        />
        <p
          v-else
          class="text-xl sm:text-3xl font-semibold text-highlighted tracking-tight"
        >
          {{ value ?? '—' }}
        </p>
        <UBadge
          v-if="hint && !loading"
          :label="hint"
          :color="color || 'primary'"
          variant="soft"
          size="sm"
        />
      </div>
      <UAvatar
        :icon="icon"
        size="lg"
        class="shrink-0 max-[400px]:hidden"
        :ui="tones[props.color || 'primary']"
      />
    </div>
  </UCard>
</template>
