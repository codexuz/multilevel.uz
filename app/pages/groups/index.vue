<script setup lang="ts">
/** My groups: the classes I am in, each with what is waiting there; "Join a group" (top) asks for a code. */
const { t } = useI18n()
useSeoMeta({ title: () => t('groups.title'), robots: 'noindex' })
const { data, status } = await useMyGroups()
const joinOpen = ref(false)
</script>

<template>
  <AppPage
    :title="t('groups.title')"
    icon="i-lucide-users"
  >
    <template #actions>
      <UButton
        :label="t('groups.joinTitle')"
        icon="i-lucide-user-plus"
        data-testid="open-join"
        @click="joinOpen = true"
      />
    </template>

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
        :actions="[{ label: t('groups.joinTitle'), icon: 'i-lucide-user-plus', onClick: () => { joinOpen = true } }]"
      />
    </div>

    <UModal
      v-model:open="joinOpen"
      :title="t('groups.joinTitle')"
      :description="t('groups.joinText')"
    >
      <template #body>
        <GroupJoin />
      </template>
    </UModal>
  </AppPage>
</template>
