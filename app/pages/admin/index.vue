<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'staff' })

const { data: stats } = await useFetch<{
  tests: number
  published: number
  pendingGrading: number
  students: number
}>('/api/admin/stats')

const cards = computed(() => [
  { label: 'Total tests', value: stats.value?.tests ?? 0, icon: 'i-lucide-clipboard-list', to: '/admin/tests' },
  { label: 'Published', value: stats.value?.published ?? 0, icon: 'i-lucide-globe', to: '/admin/tests' },
  { label: 'Awaiting grading', value: stats.value?.pendingGrading ?? 0, icon: 'i-lucide-check-check', to: '/admin/grading' },
  { label: 'Students', value: stats.value?.students ?? 0, icon: 'i-lucide-users', to: '/admin/users' }
])
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Overview
      </h1>
      <UButton
        to="/admin/tests/new"
        icon="i-lucide-plus"
        label="New test"
      />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UPageCard
        v-for="c in cards"
        :key="c.label"
        :to="c.to"
        :icon="c.icon"
        :title="String(c.value)"
        :description="c.label"
      />
    </div>
  </div>
</template>
