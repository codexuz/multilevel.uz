<script setup lang="ts">
/** Joining a class with the code a teacher gave, or a centre as a teacher with its teacher code. */
const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { refresh } = useMe()
const classCode = ref('')
const teacherCode = ref('')
const teacher = ref(false)
const busy = ref(false)

function joinClass() {
  const c = classCode.value.trim().toUpperCase()
  if (c) router.push(`/join/${encodeURIComponent(c)}`)
}
async function joinAsTeacher() {
  busy.value = true
  try {
    const c = await $fetch<{ name: string }>('/api/centres/teacher-join', { method: 'POST', body: { code: teacherCode.value } })
    await refresh()
    toast.add({ title: t('classes.teachNow', { name: c.name }), color: 'success' })
    await router.push('/centre')
  } catch (e) {
    toast.add({ title: t('classes.notJoined'), description: errorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
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
          {{ t('classes.centre') }}
        </h2>
      </div>
    </template>
    <form
      v-if="!teacher"
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
      <UButton
        :label="t('classes.iTeach')"
        variant="link"
        color="neutral"
        size="xs"
        class="self-start px-0"
        @click="teacher = true"
      />
    </form>
    <form
      v-else
      class="flex flex-col gap-2"
      @submit.prevent="joinAsTeacher"
    >
      <p class="text-sm text-muted">
        {{ t('classes.teacherText') }}
      </p>
      <div class="flex gap-2">
        <UInput
          v-model="teacherCode"
          :placeholder="t('classes.teacherCode')"
          :ui="{ base: 'uppercase font-mono' }"
          class="flex-1"
          :aria-label="t('classes.teacherCode')"
        />
        <UButton
          type="submit"
          :label="t('classes.joinTeacher')"
          :loading="busy"
          :disabled="!teacherCode.trim()"
        />
      </div>
      <UButton
        :label="t('classes.iStudy')"
        variant="link"
        color="neutral"
        size="xs"
        class="self-start px-0"
        @click="teacher = false"
      />
    </form>
  </UCard>
</template>
