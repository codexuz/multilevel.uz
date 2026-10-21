<script setup lang="ts">
/** A class's join link: shows the group and centre; joining takes a seat there, which gives Premium. */
const { t } = useI18n()
useSeoMeta({ title: () => t('join.title'), robots: 'noindex' })

const route = useRoute()
const toast = useToast()
const { loggedIn, refresh: refreshMe } = useMe()
const code = computed(() => String(route.params.code).toUpperCase())
const { data, error, refresh } = await useFetch<{ group: { id: string, name: string }, centre: { name: string }, open: boolean, member: boolean }>(() => `/api/join/${code.value}`)
const joining = ref(false)

async function join() {
  joining.value = true
  try {
    await $fetch(`/api/join/${code.value}`, { method: 'POST' })
    await Promise.all([refresh(), refreshMe()])
    toast.add({ title: t('join.joined', { name: data.value?.group.name }), description: t('join.joinedText'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('join.couldNot'), description: errorMessage(e), color: 'error' })
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <AppPage
    :title="t('join.title')"
    icon="i-lucide-school"
  >
    <div class="w-full max-w-md mx-auto py-6">
      <UEmpty
        v-if="error"
        icon="i-lucide-circle-help"
        :title="t('join.noClass')"
        :description="t('join.noClassText')"
        :actions="[{ label: t('results.browse'), to: '/tests' }]"
      />
      <UCard
        v-else-if="data"
        :ui="{ body: 'flex flex-col items-center text-center gap-3 py-8' }"
      >
        <div class="size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <UIcon
            name="i-lucide-school"
            class="size-8"
          />
        </div>
        <p class="text-sm text-muted">
          {{ data.centre.name }}
        </p>
        <h1 class="text-2xl font-bold text-highlighted">
          {{ data.group.name }}
        </h1>
        <template v-if="data.member">
          <UBadge
            :label="t('join.inClass')"
            color="success"
            variant="subtle"
            icon="i-lucide-check"
          />
          <p class="text-sm text-muted">
            {{ t('join.inClassText') }}
          </p>
          <UButton
            to="/results"
            :label="t('join.seeWork')"
          />
        </template>
        <template v-else-if="!data.open">
          <p class="text-sm text-muted">
            {{ t('join.full') }}
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">
            {{ t('join.why') }}
          </p>
          <UButton
            v-if="loggedIn"
            :label="t('join.join')"
            icon="i-lucide-log-in"
            size="lg"
            :loading="joining"
            @click="join"
          />
          <UButton
            v-else
            :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
            :label="t('join.signIn')"
            icon="i-lucide-log-in"
            size="lg"
          />
        </template>
      </UCard>
    </div>
  </AppPage>
</template>
