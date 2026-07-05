<script setup lang="ts">
import { SECTION_META } from '~/types/exam'

interface TestDetail {
  test: { id: string, title: string, description: string | null, level: string | null, isPremium: boolean }
  sections: { id: string, type: keyof typeof SECTION_META, title: string, durationMinutes: number, orderIndex: number }[]
  attempts: { id: string, sectionId: string, status: string, totalScore: number | null, maxScore: number | null }[]
}

const route = useRoute()
const testId = route.params.id as string
const { isPremium } = useMe()
const toast = useToast()

const { data } = await useFetch<TestDetail>(`/api/tests/${testId}`)

const locked = computed(() => data.value?.test.isPremium && !isPremium.value)
function attemptFor(sectionId: string) {
  // attempts arrive oldest-first; the last one is the most recent (in-progress or latest result)
  return data.value?.attempts.filter(a => a.sectionId === sectionId).at(-1)
}

const starting = ref<string | null>(null)
async function startSection(sectionId: string) {
  starting.value = sectionId
  try {
    const { attemptId } = await $fetch<{ attemptId: string }>('/api/attempts/start', { method: 'POST', body: { sectionId } })
    await navigateTo(`/exam/${attemptId}`)
  } catch (e) {
    toast.add({ title: (e as { data?: { message?: string } })?.data?.message || 'Could not start section', color: 'error' })
  } finally {
    starting.value = null
  }
}

async function retakeSection(sectionId: string) {
  if (!confirm('Retake this section? A new attempt will start — your previous result stays saved.')) return
  await startSection(sectionId)
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
          v-if="data.test.isPremium"
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
      description="Upgrade or unlock with coins to take all sections."
      :actions="[{ label: 'Go to Upgrade', to: '/upgrade', color: 'primary' }]"
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
              {{ s.durationMinutes }} minutes
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
          <div
            v-if="attemptFor(s.id) && attemptFor(s.id)!.status !== 'in_progress'"
            class="flex gap-2"
          >
            <UButton
              :to="`/results/${attemptFor(s.id)!.id}`"
              variant="subtle"
              color="neutral"
              label="View result"
              class="flex-1"
              block
            />
            <UButton
              :loading="starting === s.id"
              :disabled="!!locked"
              color="primary"
              variant="outline"
              icon="i-lucide-rotate-ccw"
              label="Retake"
              class="flex-1"
              block
              @click="retakeSection(s.id)"
            />
          </div>
          <UButton
            v-else
            :loading="starting === s.id"
            :disabled="!!locked"
            :label="attemptFor(s.id)?.status === 'in_progress' ? 'Resume' : 'Start section'"
            trailing-icon="i-lucide-arrow-right"
            block
            @click="startSection(s.id)"
          />
        </template>
      </UCard>
    </div>
  </UContainer>
</template>
