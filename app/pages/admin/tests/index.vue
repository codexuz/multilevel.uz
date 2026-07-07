<script setup lang="ts">
import type { TestDto } from '~/types/models'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const toast = useToast()
const tests = ref<TestDto[]>([])
const loading = ref(true)

function errorStatus(e: unknown) {
  return (e as { statusCode?: number, response?: { status?: number }, data?: { statusCode?: number } }).statusCode
    ?? (e as { statusCode?: number, response?: { status?: number }, data?: { statusCode?: number } }).response?.status
    ?? (e as { statusCode?: number, response?: { status?: number }, data?: { statusCode?: number } }).data?.statusCode
}

async function handleLoadError(e: unknown) {
  const status = errorStatus(e)
  if (status === 401) {
    await navigateTo('/login')
    return
  }
  if (status === 403) {
    await navigateTo('/dashboard')
    return
  }
  toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
}

async function refresh() {
  loading.value = true
  try {
    tests.value = await $fetch<TestDto[]>('/api/admin/tests')
  } catch (e) {
    await handleLoadError(e)
  } finally {
    loading.value = false
  }
}

async function togglePublish(t: TestDto) {
  const next = t.status === 'published' ? 'draft' : 'published'
  try {
    await $fetch(`/api/admin/tests/${t.id}`, { method: 'PATCH', body: { status: next } })
    await refresh()
  } catch (e) {
    toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
  }
}
async function remove(t: TestDto) {
  if (!confirm(`Delete "${t.title}"? This removes all its sections and questions.`)) return
  try {
    await $fetch(`/api/admin/tests/${t.id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
  }
}

onMounted(refresh)
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Tests
      </h1>
      <UButton
        to="/admin/tests/new"
        icon="i-lucide-plus"
        label="New test"
      />
    </div>

    <div
      v-if="loading"
      class="text-muted"
    >
      Loading…
    </div>

    <UCard
      v-else-if="tests.length"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <div class="divide-y divide-default">
        <div
          v-for="t in tests"
          :key="t.id"
          class="flex items-center gap-4 p-4"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <NuxtLink
                :to="`/admin/tests/${t.id}`"
                class="font-medium hover:text-primary truncate"
              >
                {{ t.title }}
              </NuxtLink>
              <UBadge
                v-if="t.isPremium"
                color="primary"
                variant="subtle"
                size="sm"
                label="Premium"
              />
            </div>
            <p class="text-xs text-muted truncate">
              {{ t.description || 'No description' }}
            </p>
          </div>
          <UBadge
            :color="t.status === 'published' ? 'success' : 'neutral'"
            variant="subtle"
            :label="t.status"
          />
          <UButton
            :to="`/admin/tests/${t.id}`"
            icon="i-lucide-pencil"
            variant="ghost"
            color="neutral"
          />
          <UButton
            :icon="t.status === 'published' ? 'i-lucide-eye-off' : 'i-lucide-globe'"
            variant="ghost"
            color="neutral"
            @click="togglePublish(t)"
          />
          <UButton
            icon="i-lucide-trash-2"
            variant="ghost"
            color="error"
            @click="remove(t)"
          />
        </div>
      </div>
    </UCard>

    <UAlert
      v-else
      icon="i-lucide-inbox"
      color="neutral"
      variant="subtle"
      title="No tests yet"
      description="Create your first test to get started."
    />
  </div>
</template>
