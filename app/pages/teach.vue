<script setup lang="ts">
/**
 * For teachers (public, for search engines too): what a teacher gets on Mockmee, free, and the way
 * in. Signed in, it leads to My classes (making the first class there); a guest signs in first and,
 * new, is asked in onboarding to name their first class.
 */
definePageMeta({ guestLayout: true })
const { t } = useI18n()
const { me, loggedIn } = useMe()

useSeoMeta({
  title: () => t('teach.seoTitle'),
  description: () => t('teach.seoDescription'),
  ogTitle: () => t('teach.seoTitle'),
  ogDescription: () => t('teach.seoDescription')
})

// A guest signs in (and, new, is asked in onboarding whether they teach); a teacher opens their panel;
// a student's account is switched to a teacher's, once they agree.
const area = computed(() => (loggedIn.value ? areaOf(me.value?.role) : null))
const start = computed(() => (!loggedIn.value ? `/login?next=${encodeURIComponent('/classes')}` : area.value === 'student' ? undefined : homeOf(me.value?.role)))
const startLabel = computed(() => (area.value === 'teacher' || area.value === 'admin' ? t('teach.openPanel') : t('teach.start')))
const switchOpen = ref(false)
const switching = ref(false)
const { refresh } = useMe()
function onStart() {
  if (area.value === 'student') switchOpen.value = true
}
async function becomeTeacher() {
  switching.value = true
  try {
    await $fetch('/api/me/teacher', { method: 'POST' })
    await refresh()
    await navigateTo('/teacher')
  } finally {
    switching.value = false
  }
}

const FEATURES = [
  { icon: 'i-lucide-link', key: 'join' },
  { icon: 'i-lucide-list-checks', key: 'assign' },
  { icon: 'i-lucide-gauge', key: 'marked' },
  { icon: 'i-lucide-chart-column', key: 'progress' },
  { icon: 'i-lucide-pen-line', key: 'writing' },
  { icon: 'i-lucide-monitor-check', key: 'mocks' }
]
</script>

<template>
  <AppPage
    :title="t('teach.title')"
    icon="i-lucide-presentation"
  >
    <div class="flex flex-col gap-12 max-w-5xl w-full mx-auto">
      <section class="flex flex-col gap-4 text-center items-center pt-2">
        <UBadge
          :label="t('teach.badge')"
          icon="i-lucide-presentation"
          color="primary"
          variant="subtle"
        />
        <h1 class="text-3xl sm:text-5xl font-bold text-highlighted text-balance max-w-3xl">
          {{ t('teach.heading') }}
        </h1>
        <p class="text-muted sm:text-lg max-w-2xl text-pretty">
          {{ t('teach.lead') }}
        </p>
        <div class="flex flex-wrap justify-center gap-2 pt-2">
          <UButton
            :to="start"
            :label="startLabel"
            icon="i-lucide-plus"
            size="xl"
            data-testid="teach-start"
            @click="onStart"
          />
          <UButton
            to="/tests"
            :label="t('teach.seeTests')"
            color="neutral"
            variant="outline"
            size="xl"
          />
        </div>
        <p class="text-sm text-muted">
          {{ t('teach.freeNote') }}
        </p>
      </section>

      <section class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="f in FEATURES"
          :key="f.key"
          :ui="{ body: 'p-5 flex flex-col gap-2' }"
        >
          <div class="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <UIcon
              :name="f.icon"
              class="size-5"
            />
          </div>
          <h2 class="font-semibold text-highlighted">
            {{ t(`teach.f.${f.key}Title`) }}
          </h2>
          <p class="text-sm text-muted">
            {{ t(`teach.f.${f.key}Text`) }}
          </p>
        </UCard>
      </section>

      <section class="flex flex-col gap-4">
        <h2 class="text-xl sm:text-2xl font-bold text-highlighted text-center">
          {{ t('teach.howTitle') }}
        </h2>
        <ol class="grid sm:grid-cols-3 gap-4">
          <li
            v-for="n in 3"
            :key="n"
            class="flex gap-3 rounded-xl ring ring-default p-4"
          >
            <span class="size-8 shrink-0 rounded-full bg-primary text-inverted grid place-items-center font-bold">{{ n }}</span>
            <div>
              <p class="font-semibold text-highlighted">
                {{ t(`teach.step${n}Title`) }}
              </p>
              <p class="text-sm text-muted">
                {{ t(`teach.step${n}Text`) }}
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section class="rounded-2xl bg-primary/10 p-6 sm:p-10 flex flex-col items-center text-center gap-3">
        <h2 class="text-xl sm:text-2xl font-bold text-highlighted">
          {{ t('teach.ctaTitle') }}
        </h2>
        <p class="text-muted max-w-xl">
          {{ t('teach.ctaText') }}
        </p>
        <UButton
          :to="start"
          :label="startLabel"
          icon="i-lucide-plus"
          size="xl"
          @click="onStart"
        />
      </section>
      <UModal
        v-model:open="switchOpen"
        :title="t('teach.switchTitle')"
        :description="t('teach.switchText')"
      >
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="switchOpen = false"
            />
            <UButton
              :label="t('teach.switchConfirm')"
              :loading="switching"
              data-testid="become-teacher"
              @click="becomeTeacher"
            />
          </div>
        </template>
      </UModal>
    </div>
  </AppPage>
</template>
