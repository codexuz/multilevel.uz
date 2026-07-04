<script setup lang="ts">
import type { Database, Test } from '~/types/database.types'

definePageMeta({ layout: 'admin', middleware: 'staff' })

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()

const state = reactive({
  title: '',
  description: '',
  level: 'B2',
  is_premium: false
})
const saving = ref(false)

async function create() {
  if (!state.title.trim()) return toast.add({ title: 'Title is required', color: 'error' })
  saving.value = true
  const { data, error } = await supabase
    .from('tests')
    .insert({ ...state, created_by: user.value?.id })
    .select()
    .single()
  saving.value = false
  if (error) return toast.add({ title: error.message, color: 'error' })
  await navigateTo(`/admin/tests/${(data as Test).id}`)
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        to="/admin/tests"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
      />
      <h1 class="text-2xl font-bold">
        New test
      </h1>
    </div>

    <UCard :ui="{ body: 'space-y-4' }">
      <UFormField
        label="Title"
        required
      >
        <UInput
          v-model="state.title"
          class="w-full"
          placeholder="e.g. Multilevel Mock Test 1"
        />
      </UFormField>
      <UFormField label="Description">
        <UTextarea
          v-model="state.description"
          class="w-full"
          :rows="3"
        />
      </UFormField>
      <UFormField label="Level">
        <USelect
          v-model="state.level"
          :items="['A2', 'B1', 'B2', 'C1']"
          class="w-full"
        />
      </UFormField>
      <UFormField
        label="Premium"
        description="Require an active subscription to take this test"
      >
        <USwitch v-model="state.is_premium" />
      </UFormField>
      <template #footer>
        <UButton
          :loading="saving"
          label="Create test"
          icon="i-lucide-check"
          @click="() => { create() }"
        />
      </template>
    </UCard>
  </div>
</template>
