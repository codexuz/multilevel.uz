<script setup lang="ts">
defineProps<{
  title?: string
  icon?: string
  back?: string
  id?: string
}>()
</script>

<template>
  <UDashboardPanel
    :id="id"
    :ui="{ body: '*:shrink-0' }"
  >
    <template #header>
      <UDashboardNavbar
        :title="title"
        :icon="back ? undefined : icon"
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
