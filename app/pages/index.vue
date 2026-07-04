<script setup lang="ts">
import { SECTION_META, SECTION_TYPES } from '~/types/exam'

const user = useSupabaseUser()
const ctaTo = computed(() => (user.value ? '/dashboard' : '/login'))
</script>

<template>
  <div>
    <UPageHero
      title="Master the Multilevel English Exam"
      description="Full mock tests for Listening, Reading, Writing and Speaking — with a live speaking-partner call, real exam timers, and instant scoring."
      :links="[{
        label: user ? 'Go to dashboard' : 'Start practising',
        to: ctaTo,
        trailingIcon: 'i-lucide-arrow-right',
        size: 'xl'
      }, {
        label: 'Explore tests',
        to: '/tests',
        size: 'xl',
        color: 'neutral',
        variant: 'subtle'
      }]"
    />

    <UPageSection
      title="Four skills, one realistic exam"
      description="Each section mirrors the official format and timing."
    >
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <UPageCard
          v-for="type in SECTION_TYPES"
          :key="type"
          :icon="SECTION_META[type].icon"
          :title="SECTION_META[type].label"
          :description="`${SECTION_META[type].duration} min · exam format`"
        />
      </div>
    </UPageSection>

    <UPageSection
      title="Everything you need to score higher"
      :features="[{
        icon: 'i-lucide-timer',
        title: 'Real exam timers',
        description: 'Section countdowns with a one-minute warning, exactly like test day.'
      }, {
        icon: 'i-lucide-mic',
        title: 'Live speaking partner',
        description: 'Get randomly matched with another student for a live audio call to rehearse speaking parts.'
      }, {
        icon: 'i-lucide-gauge',
        title: 'Instant auto-scoring',
        description: 'Listening and Reading are graded the moment you submit. Writing and Speaking are reviewed by examiners.'
      }, {
        icon: 'i-lucide-save',
        title: 'Never lose an answer',
        description: 'Every answer autosaves as you go, so a refresh never costs you progress.'
      }]"
    />

    <UPageSection>
      <UPageCTA
        title="Ready to take a full mock test?"
        description="Sign in with Google and start your first section in seconds."
        variant="subtle"
        :links="[{ label: user ? 'Open dashboard' : 'Continue with Google', to: ctaTo, trailingIcon: 'i-lucide-arrow-right' }]"
      />
    </UPageSection>
  </div>
</template>
