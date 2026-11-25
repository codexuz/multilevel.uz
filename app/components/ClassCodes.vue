<script setup lang="ts">
/** Classes on the profile: the ones I am in, joining one with the code a teacher gave, and the way to teach my own. */
const { t } = useI18n()
const router = useRouter()
const { me } = useMe()
const classCode = ref('')

function joinClass() {
  const c = classCode.value.trim().toUpperCase()
  if (c) router.push(`/join/${encodeURIComponent(c)}`)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-school"
          class="size-5 text-primary"
        />
        <h2 class="font-semibold text-highlighted">
          {{ t('classes.title') }}
        </h2>
      </div>
    </template>
    <div class="flex flex-col gap-3">
      <ul
        v-if="me?.classes?.length"
        class="flex flex-col gap-1 text-sm"
      >
        <li
          v-for="c in me.classes"
          :key="c.id"
          class="flex items-center gap-2"
        >
          <UIcon
            name="i-lucide-users"
            class="size-4 text-muted"
          />
          <NuxtLink
            :to="`/groups/${c.id}`"
            class="font-medium text-highlighted hover:text-primary"
          >{{ c.name }}</NuxtLink>
          <span class="text-muted">· {{ c.teacher }}</span>
        </li>
      </ul>
      <form
        class="flex flex-col gap-2"
        @submit.prevent="joinClass"
      >
        <p class="text-sm text-muted">
          {{ t('classes.studentText') }}
        </p>
        <div class="flex gap-2">
          <UInput
            v-model="classCode"
            :placeholder="t('classes.classCode')"
            :ui="{ base: 'uppercase font-mono' }"
            class="flex-1"
            :aria-label="t('classes.classCode')"
          />
          <UButton
            type="submit"
            :label="t('classes.join')"
            :disabled="!classCode.trim()"
          />
        </div>
      </form>
    </div>
  </UCard>
</template>
