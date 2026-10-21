<script setup lang="ts">
/**
 * A page's frame. In the app (layouts/default.vue) it is a dashboard panel with a top bar; in the
 * public site (layouts/public.vue) it is a plain centred section, the back link and actions above it.
 * On a phone the app has no drawer: the tab bar and Profile lead everywhere, so the top bar has no
 * menu button.
 */
defineProps<{
  title?: string
  icon?: string
  back?: string
  id?: string
}>()
const inPublic = useInPublicLayout()
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
      <slot />
    </template>
  </UDashboardPanel>
</template>
