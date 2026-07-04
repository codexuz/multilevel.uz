<script setup lang="ts">
import type { Test, Section, Attempt } from '~/types/database.types'
import { SECTION_META } from '~/types/exam'

const route = useRoute()
const testId = route.params.id as string
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { isPremium } = useSubscription()
const toast = useToast()

const { data } = await useAsyncData(`test-${testId}`, async () => {
  const { data: test } = await supabase.from('tests').select('*').eq('id', testId).single()
  const { data: sections } = await supabase
    .from('sections').select('*').eq('test_id', testId).order('order_index')
  const { data: attempts } = user.value
    ? await supabase.from('attempts').select('*').eq('user_id', user.value.id).eq('test_id', testId)
    : { data: [] }
  return {
    test: test as Test | null,
    sections: (sections as Section[]) ?? [],
    attempts: (attempts as Attempt[]) ?? []
  }
})

const locked = computed(() => data.value?.test?.is_premium && !isPremium.value)

function attemptFor(sectionId: string) {
  return data.value?.attempts.find(a => a.section_id === sectionId)
}

const starting = ref<string | null>(null)
async function startSection(sectionId: string) {
  starting.value = sectionId
  try {
    const { attemptId } = await $fetch<{ attemptId: string }>('/api/attempts/start', {
      method: 'POST',
      body: { sectionId }
    })
    await navigateTo(`/exam/${attemptId}`)
  } catch (e) {
    const msg = (e as { data?: { message?: string } })?.data?.message || 'Could not start section'
    toast.add({ title: msg, color: 'error' })
  } finally {
    starting.value = null
  }
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div v-if="data?.test">
      <div class="flex items-center gap-3">
        <UButton
          to="/tests"
          icon="i-lucide-arrow-left"
          variant="ghost"
          color="neutral"
        />
        <h1 class="text-2xl font-bold">
          {{ data.test.title }}
        </h1>
        <UBadge
          v-if="data.test.is_premium"
          color="primary"
          variant="subtle"
          icon="i-lucide-sparkles"
          label="Premium"
        />
      </div>
      <p class="text-muted mt-1 ml-11">
        {{ data.test.description }}
      </p>
    </div>

    <UAlert
      v-if="locked"
      color="primary"
      variant="subtle"
      icon="i-lucide-lock"
      title="This is a premium test"
      description="Upgrade to unlock all sections."
      :actions="[{ label: 'Go Premium', to: '/upgrade', color: 'primary' }]"
    />

    <div class="grid gap-4 sm:grid-cols-2">
      <UCard
        v-for="s in data?.sections"
        :key="s.id"
      >
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-lg bg-elevated flex items-center justify-center">
            <UIcon
              :name="SECTION_META[s.type].icon"
              class="size-5 text-primary"
            />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold">
              {{ s.title }}
            </h3>
            <p class="text-xs text-muted">
              {{ s.duration_minutes }} minutes
            </p>
          </div>
          <UBadge
            v-if="attemptFor(s.id)"
            :color="attemptFor(s.id)!.status === 'graded' ? 'success' : 'warning'"
            variant="subtle"
            :label="attemptFor(s.id)!.status"
            size="sm"
          />
        </div>
        <template #footer>
          <div class="flex gap-2">
            <UButton
              v-if="attemptFor(s.id) && attemptFor(s.id)!.status !== 'in_progress'"
              :to="`/results/${attemptFor(s.id)!.id}`"
              variant="subtle"
              color="neutral"
              label="View result"
              block
            />
            <UButton
              v-else
              :loading="starting === s.id"
              :disabled="locked"
              :label="attemptFor(s.id)?.status === 'in_progress' ? 'Resume' : 'Start section'"
              trailing-icon="i-lucide-arrow-right"
              block
              @click="startSection(s.id)"
            />
          </div>
        </template>
      </UCard>
    </div>
  </UContainer>
</template>
