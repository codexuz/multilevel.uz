<script setup lang="ts">
import type { Database, Test } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const supabase = useSupabaseClient<Database>()
const { data: tests, refresh } = await useAsyncData('admin-tests-list', async () => {
  const { data } = await supabase.from('tests').select('*').order('created_at', { ascending: false })
  return (data as Test[]) ?? []
})

const toast = useToast()
async function togglePublish(t: Test) {
  const next = t.status === 'published' ? 'draft' : 'published'
  const { error } = await supabase.from('tests').update({ status: next }).eq('id', t.id)
  if (error) return toast.add({ title: error.message, color: 'error' })
  await refresh()
}
async function remove(t: Test) {
  if (!confirm(`Delete "${t.title}"? This removes all its sections and questions.`)) return
  const { error } = await supabase.from('tests').delete().eq('id', t.id)
  if (error) return toast.add({ title: error.message, color: 'error' })
  await refresh()
}
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

    <UCard
      v-if="tests?.length"
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
                v-if="t.is_premium"
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
