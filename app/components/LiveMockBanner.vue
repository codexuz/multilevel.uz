<script setup lang="ts">
/** A strip on the Tests page while a live mock is open, or before the next one. */
const { t } = useI18n()
const { live, next } = useLiveMock()
const when = (d: string) => new Date(d).toLocaleString(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <NuxtLink
    v-if="live || next"
    to="/live"
    class="flex items-center gap-3 rounded-xl px-4 py-3 ring transition-colors"
    :class="live ? 'bg-primary/10 ring-primary/30 hover:bg-primary/15' : 'bg-elevated/50 ring-default hover:bg-elevated'"
  >
    <UIcon
      name="i-lucide-trophy"
      class="size-6 shrink-0 text-primary"
    />
    <div class="flex-1 min-w-0">
      <p class="font-semibold text-highlighted truncate">
        <UBadge
          v-if="live"
          :label="t('nav.liveBadge')"
          color="error"
          variant="solid"
          size="sm"
          class="me-1.5 align-middle"
        />{{ (live ?? next)!.title }}
      </p>
      <p class="text-xs text-muted truncate">
        {{ live ? t('live.bannerOpen', { when: when(live.endsAt) }) : t('live.bannerNext', { when: when(next!.startsAt) }) }}
      </p>
    </div>
    <UIcon
      name="i-lucide-chevron-right"
      class="size-4 text-dimmed shrink-0"
    />
  </NuxtLink>
</template>
