<script setup lang="ts">
definePageMeta({ middleware: 'staff' })
useSeoMeta({ title: 'Overview', robots: 'noindex' })

const { data: stats } = await useFetch<{ tests: number, published: number, pendingMarking: number, students: number, attempts: number, premiumUsers: number, revenueThisMonthUzs: number }>('/api/admin/stats')
const { isAdmin } = useMe()
</script>

<template>
  <AppPage
    title="Overview"
    icon="i-lucide-layout-dashboard"
  >
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <StatTile
        label="Tests"
        :value="stats?.tests ?? 0"
        icon="i-lucide-files"
        color="neutral"
      />
      <StatTile
        label="Published"
        :value="stats?.published ?? 0"
        icon="i-lucide-globe"
        color="success"
      />
      <StatTile
        label="To mark"
        :value="stats?.pendingMarking ?? 0"
        icon="i-lucide-pen-line"
        color="warning"
      />
      <StatTile
        label="Students"
        :value="stats?.students ?? 0"
        icon="i-lucide-users"
        color="primary"
      />
      <StatTile
        label="Saved attempts"
        :value="stats?.attempts ?? 0"
        icon="i-lucide-clipboard-list"
        color="neutral"
      />
    </div>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-if="isAdmin"
        to="/builder"
        label="Test builder"
        icon="i-lucide-blocks"
      />
      <UButton
        to="/marking"
        label="Marking"
        icon="i-lucide-pen-line"
        color="neutral"
        variant="outline"
      />
      <UButton
        v-if="isAdmin"
        to="/admin/users"
        label="Users"
        icon="i-lucide-users"
        color="neutral"
        variant="outline"
      />
    </div>
  </AppPage>
</template>
