<script setup lang="ts">
/** Joining a class with the code a teacher gave, or a centre as a teacher with its teacher code. */
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
    toast.add({ title: `You teach at ${c.name} now`, color: 'success' })
    await router.push('/centre')
  } catch (e) {
    toast.add({ title: 'Not joined', description: errorMessage(e), color: 'error' })
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
          Learning centre
        </h2>
      </div>
    </template>
    <form
      v-if="!teacher"
      class="flex flex-col gap-2"
      @submit.prevent="joinClass"
    >
      <p class="text-sm text-muted">
        Studying at a centre? Enter the class code your teacher gave you.
      </p>
      <div class="flex gap-2">
        <UInput
          v-model="classCode"
          placeholder="Class code"
          :ui="{ base: 'uppercase font-mono' }"
          class="flex-1"
          aria-label="Class code"
        />
        <UButton
          type="submit"
          label="Join"
          :disabled="!classCode.trim()"
        />
      </div>
      <UButton
        label="I am a teacher"
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
        Enter the teacher code your centre's owner shared.
      </p>
      <div class="flex gap-2">
        <UInput
          v-model="teacherCode"
          placeholder="Teacher code"
          :ui="{ base: 'uppercase font-mono' }"
          class="flex-1"
          aria-label="Teacher code"
        />
        <UButton
          type="submit"
          label="Join as teacher"
          :loading="busy"
          :disabled="!teacherCode.trim()"
        />
      </div>
      <UButton
        label="I am a student"
        variant="link"
        color="neutral"
        size="xs"
        class="self-start px-0"
        @click="teacher = false"
      />
    </form>
  </UCard>
</template>
