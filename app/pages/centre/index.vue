<script setup lang="ts">
/**
 * A learning centre for its owner and teachers: seats and licence, the groups (each with a join link
 * for students), and for the owner the code teachers join with.
 */
useSeoMeta({ title: 'My centre', robots: 'noindex' })

interface CentreView {
  id: string
  name: string
  role: 'OWNER' | 'TEACHER'
  seats: number
  students: number
  licensedUntil: string | null
  open: boolean
  teacherCode: string | null
  teachers: { id: string, name: string, role: string }[]
  groups: { id: string, name: string, joinCode: string, archived: boolean, teacher: string | null, students: number, assignments: number }[]
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { me } = useMe()
const config = useRuntimeConfig()
const site = String(config.public.siteUrl || '').replace(/\/$/, '')

const staffCentres = computed(() => (me.value?.centres ?? []).filter(c => c.role !== 'STUDENT'))
const centreId = computed(() => (typeof route.query.c === 'string' ? route.query.c : staffCentres.value[0]?.id) ?? null)
const { data, error } = await useFetch<CentreView>(() => `/api/centres/${centreId.value}`, { immediate: !!centreId.value, watch: [centreId] })

const showArchived = ref(false)
const groups = computed(() => (data.value?.groups ?? []).filter(g => showArchived.value || !g.archived))
const creating = ref(false)
const groupName = ref('')
const saving = ref(false)

async function createGroup() {
  if (!groupName.value.trim()) return
  saving.value = true
  try {
    const g = await $fetch<{ id: string }>(`/api/centres/${centreId.value}/groups`, { method: 'POST', body: { name: groupName.value } })
    creating.value = false
    await router.push(`/centre/groups/${g.id}`)
  } catch (e) {
    toast.add({ title: 'Not created', description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
async function copy(text: string, title: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title, description: text, color: 'success' })
  } catch {}
}
</script>

<template>
  <AppPage
    title="My centre"
    icon="i-lucide-school"
  >
    <template #actions>
      <USelect
        v-if="staffCentres.length > 1"
        :model-value="centreId ?? undefined"
        :items="staffCentres.map(c => ({ label: c.name, value: c.id }))"
        class="w-48"
        @update:model-value="v => router.push({ query: { c: v } })"
      />
      <UButton
        v-if="data"
        label="New group"
        icon="i-lucide-plus"
        @click="creating = true; groupName = ''"
      />
    </template>

    <UEmpty
      v-if="!centreId || error"
      icon="i-lucide-school"
      title="You do not run a centre here yet"
      description="If your centre gave you a teacher code, enter it on your Profile."
      :actions="[{ label: 'Profile', to: '/profile' }]"
    />

    <div
      v-else-if="data"
      class="flex flex-col gap-4 max-w-4xl w-full"
    >
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          {{ data.name }}
        </h1>
        <p class="text-sm text-muted mt-1">
          {{ data.role === 'OWNER' ? 'Owner' : 'Teacher' }} · {{ data.teachers.length }} staff
        </p>
      </div>

      <UAlert
        v-if="!data.open"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="The licence has ended"
        description="Students no longer have Premium and nobody can join. Contact us to renew."
      />

      <div class="grid sm:grid-cols-3 gap-3">
        <UCard
          variant="subtle"
          :ui="{ body: 'p-4' }"
        >
          <p class="text-sm text-muted">
            Seats taken
          </p>
          <p class="text-xl font-bold text-highlighted mt-1">
            {{ data.students }} <span class="text-sm font-normal text-muted">of {{ data.seats }}</span>
          </p>
          <UProgress
            :model-value="data.seats ? Math.min(100, (data.students / data.seats) * 100) : 0"
            :color="data.students >= data.seats ? 'warning' : 'primary'"
            size="xs"
            class="mt-2"
          />
        </UCard>
        <UCard
          variant="subtle"
          :ui="{ body: 'p-4' }"
        >
          <p class="text-sm text-muted">
            Licence until
          </p>
          <p class="text-xl font-bold text-highlighted mt-1">
            {{ data.licensedUntil ? formatDate(data.licensedUntil) : '—' }}
          </p>
          <p class="text-xs text-muted mt-1">
            Students have Premium until then.
          </p>
        </UCard>
        <UCard
          v-if="data.teacherCode"
          variant="subtle"
          :ui="{ body: 'p-4' }"
        >
          <p class="text-sm text-muted">
            Teacher code
          </p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xl font-bold font-mono text-highlighted">{{ data.teacherCode }}</span>
            <UButton
              icon="i-lucide-copy"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="Copy the teacher code"
              @click="copy(data.teacherCode!, 'Teacher code copied')"
            />
          </div>
          <p class="text-xs text-muted mt-1">
            Teachers enter it on their Profile.
          </p>
        </UCard>
      </div>

      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Groups
        </h2>
        <USwitch
          v-model="showArchived"
          label="Show archived"
          size="sm"
        />
      </div>
      <UEmpty
        v-if="!groups.length"
        icon="i-lucide-users"
        title="No groups yet"
        description="Make a group for each class and share its link: students who join take a seat and get Premium."
        :actions="[{ label: 'New group', icon: 'i-lucide-plus', onClick: () => { creating = true; groupName = '' } }]"
      />
      <div class="grid sm:grid-cols-2 gap-3">
        <UCard
          v-for="g in groups"
          :key="g.id"
          :class="g.archived ? 'opacity-60' : ''"
        >
          <NuxtLink
            :to="`/centre/groups/${g.id}`"
            class="block"
          >
            <div class="flex items-center gap-2">
              <span class="font-semibold text-highlighted truncate">{{ g.name }}</span>
              <UBadge
                v-if="g.archived"
                label="Archived"
                color="neutral"
                variant="subtle"
                size="sm"
              />
            </div>
            <p class="text-xs text-muted mt-1">
              {{ g.students }} {{ g.students === 1 ? 'student' : 'students' }} · {{ g.assignments }} {{ g.assignments === 1 ? 'assignment' : 'assignments' }}{{ g.teacher ? ` · ${g.teacher}` : '' }}
            </p>
          </NuxtLink>
          <div class="flex items-center gap-2 mt-3">
            <span class="font-mono text-sm text-toned">{{ g.joinCode }}</span>
            <UButton
              label="Copy join link"
              icon="i-lucide-link"
              size="xs"
              color="neutral"
              variant="outline"
              @click="copy(`${site}/join/${g.joinCode}`, 'Join link copied')"
            />
          </div>
        </UCard>
      </div>
    </div>

    <UModal
      v-model:open="creating"
      title="New group"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="createGroup"
        >
          <UFormField label="Name">
            <UInput
              v-model="groupName"
              placeholder="e.g. B2 evening, Mon/Wed/Fri"
              class="w-full"
              autofocus
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              @click="creating = false"
            />
            <UButton
              type="submit"
              label="Create"
              :loading="saving"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
