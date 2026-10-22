<script setup lang="ts">
import type { Pack } from '~/utils/billing'

definePageMeta({ guestLayout: true })

/**
 * Test packs: sets of tests (authentic IELTS papers, Multilevel mocks) bought once and kept for
 * good, beside Premium, which opens everything while it runs. One exam at a time, like the catalogue.
 */
const route = useRoute()
const { t } = useI18n()
const { exam, setExam } = useExam()
if (isExam(route.query.exam) && route.query.exam !== exam.value) await setExam(route.query.exam)
const { data: packs, status } = await useFetch<Pack[]>('/api/packs', { query: computed(() => ({ exam: exam.value })), default: () => [] })

useSeoMeta({
  title: () => t('packs.seoTitle'),
  description: () => t('packs.seoDescription')
})
</script>

<template>
  <AppPage
    :title="t('packs.title')"
    icon="i-lucide-package"
  >
    <div class="flex flex-col gap-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ t('packs.heading') }}
        </h1>
        <p class="text-muted mt-1 max-w-2xl">
          {{ t('packs.intro') }}
        </p>
      </div>

      <ExamSwitch />

      <div
        v-if="status === 'pending' && !packs.length"
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <USkeleton
          v-for="i in 3"
          :key="i"
          class="h-44 rounded-xl"
        />
      </div>
      <div
        v-else-if="!packs.length"
        class="flex flex-col items-center text-center gap-3 rounded-xl ring ring-default px-6 py-12"
      >
        <UIcon
          name="i-lucide-package-open"
          class="size-12 text-dimmed"
        />
        <p class="font-semibold text-highlighted">
          {{ t('packs.none', { exam: examLabel(exam) }) }}
        </p>
        <p class="text-sm text-muted max-w-sm">
          {{ t('packs.noneText') }}
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <UButton
            :to="`/tests?exam=${exam}`"
            :label="t('packs.browseTests')"
          />
          <UButton
            to="/pricing"
            label="Premium"
            icon="i-lucide-sparkles"
            color="neutral"
            variant="outline"
          />
        </div>
      </div>
      <div
        v-else
        class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        <PackCard
          v-for="p in packs"
          :key="p.id"
          :pack="p"
        />
      </div>

      <UCard
        variant="subtle"
        :ui="{ body: 'flex flex-col sm:flex-row gap-4 sm:items-center' }"
      >
        <UIcon
          name="i-lucide-sparkles"
          class="size-8 text-primary shrink-0"
        />
        <div class="flex-1">
          <p class="font-semibold text-highlighted">
            {{ t('packs.orPremium') }}
          </p>
          <p class="text-sm text-muted">
            {{ t('packs.orPremiumText') }}
          </p>
        </div>
        <UButton
          to="/pricing"
          :label="t('packs.seePremium')"
          color="neutral"
          variant="outline"
        />
      </UCard>
    </div>
  </AppPage>
</template>
