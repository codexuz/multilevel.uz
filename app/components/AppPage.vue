<script setup lang="ts">
/**
 * A page's frame:
 * - In public site (layouts/public.vue): plain centred section with back link and actions.
 * - In split Admin / Teacher panels (layouts/admin.vue, layouts/teacher.vue): clean panel content
 *   wrapper with inline page actions and toolbar (no duplicate sidebar/top navbar).
 * - In student app (layouts/default.vue): Nuxt UI UDashboardPanel with top navbar.
 */
defineProps<{
  title?: string
  icon?: string
  back?: string
  id?: string
  wide?: boolean
}>()
const inPublic = useInPublicLayout()
const panel = usePanelLayout()
const { t } = useI18n()
</script>

<template>
  <div
    v-if="inPublic"
    class="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex flex-col gap-6"
  >
    <div
      v-if="back || $slots.actions"
      class="flex items-center justify-between gap-3 -mb-2"
    >
      <UButton
        v-if="back"
        :to="back"
        icon="i-lucide-arrow-left"
        :label="t('common.back')"
        color="neutral"
        variant="ghost"
        class="-ms-2"
      />
      <div class="ms-auto flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <slot name="toolbar" />
    <slot />
  </div>

  <!-- Inside Admin or Teacher Panel Shell -->
  <div
    v-else-if="panel"
    class="mx-auto w-full flex flex-col gap-5"
    :class="wide ? '' : 'max-w-7xl'"
  >
    <div
      v-if="back || title || $slots.actions"
      class="flex flex-wrap items-center justify-between gap-3"
    >
      <div class="flex items-center gap-2 min-w-0">
        <UButton
          v-if="back"
          :to="back"
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="soft"
          size="sm"
          square
        />
        <div
          v-if="title"
          class="flex items-center gap-2 min-w-0"
        >
          <UIcon
            v-if="icon && !back"
            :name="icon"
            class="size-5 text-primary shrink-0"
          />
          <h2 class="text-lg sm:text-xl font-bold text-highlighted truncate">
            {{ title }}
          </h2>
        </div>
      </div>
      <div
        v-if="$slots.actions"
        class="flex flex-wrap items-center gap-2 ms-auto"
      >
        <slot name="actions" />
      </div>
    </div>

    <div v-if="$slots.toolbar">
      <slot name="toolbar" />
    </div>

    <div
      class="flex flex-col gap-4 sm:gap-6"
      :class="wide ? 'w-full' : 'w-full'"
    >
      <slot />
    </div>
  </div>

  <UDashboardPanel
    v-else
    :id="id"
    :ui="{ body: '*:shrink-0' }"
  >
    <template #header>
      <UDashboardNavbar
        :title="title"
        :icon="back ? undefined : icon"
        :toggle="false"
      >
        <template
          v-if="back"
          #leading
        >
          <UDashboardSidebarCollapse class="max-lg:hidden" />
          <UButton
            :to="back"
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            square
          />
        </template>
        <template
          v-else
          #leading
        >
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <slot name="actions" />
        </template>
      </UDashboardNavbar>
      <slot name="toolbar" />
    </template>

    <template #body>
      <slot v-if="wide" />
      <div
        v-else
        class="mx-auto w-full max-w-6xl flex flex-col gap-4 sm:gap-6 *:mx-auto *:w-full"
      >
        <slot />
      </div>
    </template>
  </UDashboardPanel>
</template>
