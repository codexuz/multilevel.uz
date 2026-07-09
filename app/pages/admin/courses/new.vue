<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'staff' })

const toast = useToast()

const state = reactive({
  title: '',
  description: '',
  level: 'B2',
  category: 'General',
  is_premium: false
})
const saving = ref(false)

async function create() {
  if (!state.title.trim()) return toast.add({ title: 'Title is required', color: 'error' })
  saving.value = true
  try {
    const { id } = await $fetch<{ id: string }>('/api/admin/courses', {
      method: 'POST',
      body: {
        title: state.title,
        description: state.description,
        level: state.level,
        category: state.category,
        isPremium: state.is_premium
      }
    })
    await navigateTo(`/admin/courses/${id}`)
  } catch (e) {
    toast.add({ title: (e as { data?: { message?: string } })?.data?.message ?? 'Failed', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-xl space-y-6">
    <div class="flex items-center gap-3">
      <UButton
        to="/admin/courses"
        icon="i-lucide-arrow-left"
        variant="ghost"
        color="neutral"
      />
      <h1 class="text-2xl font-bold">
        New course
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
          placeholder="e.g. Grammar Foundations B2"
        />
      </UFormField>
      <UFormField label="Description">
        <UTextarea
          v-model="state.description"
          class="w-full"
          :rows="3"
        />
      </UFormField>
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Level">
          <USelect
            v-model="state.level"
            :items="['A2', 'B1', 'B2', 'C1']"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Category">
          <UInput
            v-model="state.category"
            class="w-full"
            placeholder="Grammar"
          />
        </UFormField>
      </div>
      <UFormField
        label="Premium"
        description="Require an active subscription to enroll"
      >
        <USwitch v-model="state.is_premium" />
      </UFormField>
      <template #footer>
        <UButton
          :loading="saving"
          label="Create course"
          icon="i-lucide-check"
          @click="() => { create() }"
        />
      </template>
    </UCard>
  </div>
</template>
