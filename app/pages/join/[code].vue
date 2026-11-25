<script setup lang="ts">
/** A class's join link: shows the class and its teacher; joining brings the teacher's work, and they see the student's results. */
const { t } = useI18n()
useSeoMeta({ title: () => t('join.title'), robots: 'noindex' })

const route = useRoute()
const toast = useToast()
const { loggedIn, refresh: refreshMe } = useMe()
const code = computed(() => String(route.params.code).toUpperCase())
const { data, error, refresh } = await useFetch<{ group: { id: string, name: string }, teacher: string | null, member: boolean, mine: boolean }>(() => `/api/join/${code.value}`)
const joining = ref(false)

async function join() {
  joining.value = true
  try {
    await $fetch(`/api/join/${code.value}`, { method: 'POST' })
    await Promise.all([refresh(), refreshMe(), refreshNuxtData('my-groups')])
    toast.add({ title: t('join.joined', { name: data.value?.group.name }), description: t('join.joinedText'), color: 'success' })
    if (data.value) await navigateTo(`/groups/${data.value.group.id}`)
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
        <p
          v-if="data.teacher"
          class="text-sm text-muted"
        >
          {{ t('join.teacher', { name: data.teacher }) }}
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
            :to="`/groups/${data.group.id}`"
            :label="t('groups.open')"
          />
        </template>
        <template v-else-if="data.mine">
          <p class="text-sm text-muted">
            {{ t('join.mine') }}
          </p>
          <UButton
            :to="`/classes/${data.group.id}`"
            :label="t('join.openMine')"
          />
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
