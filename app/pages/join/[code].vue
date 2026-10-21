<script setup lang="ts">
/** A class's join link: shows the group and centre; joining takes a seat there, which gives Premium. */
useSeoMeta({ title: 'Join a class', robots: 'noindex' })

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
    toast.add({ title: `You joined ${data.value?.group.name}`, description: 'Premium is on while you are in the class.', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Could not join', description: errorMessage(e), color: 'error' })
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <AppPage
    title="Join a class"
    icon="i-lucide-school"
  >
    <div class="w-full max-w-md mx-auto py-6">
      <UEmpty
        v-if="error"
        icon="i-lucide-circle-help"
        title="No class has that code"
        description="Check the link or the code with your teacher."
        :actions="[{ label: 'Browse tests', to: '/tests' }]"
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
            label="You are in this class"
            color="success"
            variant="subtle"
            icon="i-lucide-check"
          />
          <p class="text-sm text-muted">
            Your teacher's work shows on My results, and every test is open to you.
          </p>
          <UButton
            to="/results"
            label="See my work"
          />
        </template>
        <template v-else-if="!data.open">
          <p class="text-sm text-muted">
            The class is full or the centre's licence has ended. Ask your teacher.
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-muted">
            Join to get the work your teacher sets, and Premium for every test while you are in the class.
          </p>
          <UButton
            v-if="loggedIn"
            label="Join the class"
            icon="i-lucide-log-in"
            size="lg"
            :loading="joining"
            @click="join"
          />
          <UButton
            v-else
            :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
            label="Sign in to join"
            icon="i-lucide-log-in"
            size="lg"
          />
        </template>
      </UCard>
    </div>
  </AppPage>
</template>
