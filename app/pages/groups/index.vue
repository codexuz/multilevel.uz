<script setup lang="ts">
/** My groups: the classes I am in, each with what is waiting there, and joining one with a code. */
const { t } = useI18n()
useSeoMeta({ title: () => t('groups.title'), robots: 'noindex' })
const { data, status } = await useMyGroups()
</script>

<template>
  <AppPage
    :title="t('groups.title')"
    icon="i-lucide-users"
  >
    <div class="flex flex-col gap-5 max-w-4xl w-full">
      <USkeleton
        v-if="status === 'pending' && !data.groups.length"
        class="h-32 rounded-[var(--card-radius)]"
      />
      <div
        v-else-if="data.groups.length"
        class="grid sm:grid-cols-2 gap-3"
        data-testid="my-groups"
      >
        <GroupCard
          v-for="g in data.groups"
          :key="g.id"
          :group="g"
        />
      </div>
      <UEmpty
        v-else
        icon="i-lucide-users"
        :title="t('groups.noneTitle')"
        :description="t('groups.noneText')"
      />

      <UCard>
        <template #header>
          <p class="font-extrabold text-highlighted">
            {{ t('groups.joinTitle') }}
          </p>
          <p class="text-sm text-muted mt-0.5">
            {{ t('groups.joinText') }}
          </p>
        </template>
        <GroupJoin />
      </UCard>
    </div>
  </AppPage>
</template>
