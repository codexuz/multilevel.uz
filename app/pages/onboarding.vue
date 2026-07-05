<script setup lang="ts">
const { me, refresh } = useMe()
const toast = useToast()

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const DURATIONS = [
  { value: '<6m', label: 'Less than 6 months' },
  { value: '6-12m', label: '6–12 months' },
  { value: '1-2y', label: '1–2 years' },
  { value: '2y+', label: 'More than 2 years' }
]

const currentLevel = ref<string | null>(me.value?.currentLevel ?? null)
const learningDuration = ref<string | null>(me.value?.learningDuration ?? null)
const targetLevel = ref<string | null>(me.value?.targetLevel ?? null)
const targetScore = ref<number | null>(me.value?.targetScore ?? null)
const saving = ref(false)

const canSubmit = computed(() => !!currentLevel.value && !!learningDuration.value
  && (!!targetLevel.value || targetScore.value != null))

async function submit() {
  saving.value = true
  try {
    await $fetch('/api/me/onboarding', {
      method: 'POST',
      body: {
        currentLevel: currentLevel.value,
        learningDuration: learningDuration.value,
        targetLevel: targetLevel.value,
        targetScore: targetScore.value
      }
    })
    await refresh()
    await navigateTo('/dashboard')
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 max-w-xl">
    <div class="text-center space-y-2 mb-8">
      <UIcon name="i-lucide-rocket" class="size-10 text-primary mx-auto" />
      <h1 class="text-2xl font-bold">
        Let's set up your goals
      </h1>
      <p class="text-muted">
        This helps us tailor your practice and track your progress.
      </p>
    </div>

    <UCard>
      <div class="space-y-6">
        <UFormField label="Your current English level" required>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="l in LEVELS"
              :key="l"
              :color="currentLevel === l ? 'primary' : 'neutral'"
              :variant="currentLevel === l ? 'solid' : 'subtle'"
              :label="l"
              @click="currentLevel = l"
            />
          </div>
        </UFormField>

        <UFormField label="How long have you been learning English?" required>
          <div class="flex flex-col gap-2">
            <UButton
              v-for="d in DURATIONS"
              :key="d.value"
              :color="learningDuration === d.value ? 'primary' : 'neutral'"
              :variant="learningDuration === d.value ? 'solid' : 'subtle'"
              :label="d.label"
              block
              class="justify-start"
              @click="learningDuration = d.value"
            />
          </div>
        </UFormField>

        <UFormField label="Target level" hint="optional">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="l in LEVELS"
              :key="l"
              :color="targetLevel === l ? 'primary' : 'neutral'"
              :variant="targetLevel === l ? 'solid' : 'subtle'"
              :label="l"
              @click="targetLevel = targetLevel === l ? null : l"
            />
          </div>
        </UFormField>

        <UFormField label="Target score" hint="0–75, optional">
          <UInput
            v-model.number="targetScore"
            type="number"
            :min="0"
            :max="75"
            placeholder="e.g. 65"
          />
        </UFormField>
      </div>

      <template #footer>
        <UButton
          block
          size="lg"
          :loading="saving"
          :disabled="!canSubmit"
          label="Start learning"
          trailing-icon="i-lucide-arrow-right"
          @click="submit"
        />
      </template>
    </UCard>
  </UContainer>
</template>
