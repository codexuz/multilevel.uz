<script setup lang="ts">
import type { Pack } from '~/utils/billing'

/**
 * A test pack as a tile: its title, how many tests and parts are in it, the price (and the old one struck
 * through), and whether it is already the user's. The whole tile opens the pack's page.
 */
const props = defineProps<{ pack: Pack }>()
const { t } = useI18n()
const contents = computed(() => packContents(props.pack, t))
const saving = computed(() => (props.pack.oldPriceUzs && props.pack.oldPriceUzs > props.pack.priceUzs
  ? Math.round((1 - props.pack.priceUzs / props.pack.oldPriceUzs) * 100)
  : 0))
</script>

<template>
  <NuxtLink
    :to="`/packs/${pack.slug}`"
    class="group relative flex flex-col gap-3 overflow-hidden rounded-xl bg-default p-4 ring transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-primary/40"
    :class="pack.featured ? 'ring-2 ring-primary' : 'ring-default'"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <UIcon
          name="i-lucide-package"
          class="size-4"
        />{{ t('packs.pack') }} · {{ examLabel(pack.exam) }}
      </span>
      <UBadge
        v-if="pack.owned"
        :label="t('packs.owned')"
        icon="i-lucide-check"
        color="success"
        variant="soft"
        size="sm"
      />
      <UBadge
        v-else-if="saving"
        :label="`−${saving}%`"
        color="error"
        variant="soft"
        size="sm"
      />
    </div>
    <div>
      <h3 class="font-semibold text-highlighted leading-snug line-clamp-2">
        {{ pack.title }}
      </h3>
      <p
        v-if="pack.description"
        class="mt-1 text-sm text-muted line-clamp-2"
      >
        {{ pack.description }}
      </p>
    </div>
    <div class="mt-auto flex items-end justify-between gap-3">
      <p class="text-sm text-toned">
        {{ contents }}
      </p>
      <div class="text-right">
        <p
          v-if="pack.oldPriceUzs && !pack.owned"
          class="text-xs text-dimmed line-through"
        >
          {{ fmtUzs(pack.oldPriceUzs) }}
        </p>
        <p class="font-bold text-highlighted">
          {{ pack.owned ? t('packs.open') : fmtUzs(pack.priceUzs) }}
        </p>
      </div>
    </div>
  </NuxtLink>
</template>
