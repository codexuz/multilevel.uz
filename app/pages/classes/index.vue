<script setup lang="ts">
/**
 * My classes, as a teacher: each with its join link to share, how many students and assignments it
 * has, and a way to make a new one (the first one makes the user a teacher). Classes are free, with
 * no limit on students.
 */
const { t } = useI18n()
useSeoMeta({ title: () => t('nav.classes'), robots: 'noindex' })

interface ClassRow { id: string, name: string, joinCode: string, archived: boolean, createdAt: string, students: number, assignments: number }

const router = useRouter()
const toast = useToast()
const { refresh: refreshMe } = useMe()
const config = useRuntimeConfig()
const site = String(config.public.siteUrl || '').replace(/\/$/, '')

const { data, status } = await useFetch<{ classes: ClassRow[] }>('/api/classes', { default: () => ({ classes: [] }) })
const showArchived = ref(false)
const classes = computed(() => data.value.classes.filter(c => showArchived.value || !c.archived))
const archivedCount = computed(() => data.value.classes.filter(c => c.archived).length)

const creating = ref(false)
const name = ref('')
const saving = ref(false)
function startCreate() {
  name.value = ''
  creating.value = true
}
async function create() {
  if (!name.value.trim()) return
  saving.value = true
  try {
    const first = !data.value.classes.length
    const c = await $fetch<{ id: string }>('/api/classes', { method: 'POST', body: { name: name.value } })
    creating.value = false
    // The first class makes them a teacher: the menu changes.
    if (first) await refreshMe()
    await router.push(`/classes/${c.id}${first ? '?welcome=1' : ''}`)
  } catch (e) {
    toast.add({ title: t('centre.notCreated'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: t('centre.joinLinkCopied'), description: text, color: 'success' })
  } catch {}
}
const telegramShare = (c: ClassRow) => `https://t.me/share/url?url=${encodeURIComponent(`${site}/join/${c.joinCode}`)}&text=${encodeURIComponent(t('classes.shareText', { name: c.name }))}`
</script>

<template>
  <AppPage
    :title="t('nav.classes')"
    icon="i-lucide-school"
  >
    <template #actions>
      <UButton
        v-if="data.classes.length"
        :label="t('classes.newClass')"
        icon="i-lucide-plus"
        data-testid="new-class"
        @click="startCreate"
      />
    </template>

    <div class="flex flex-col gap-4 max-w-4xl w-full">
      <div
        v-if="status === 'pending' && !data.classes.length"
        class="grid sm:grid-cols-2 gap-3"
      >
        <USkeleton
          v-for="i in 4"
          :key="i"
          class="h-32 rounded-xl"
        />
      </div>

      <UCard
        v-else-if="!data.classes.length"
        :ui="{ body: 'p-6 sm:p-8 flex flex-col items-center text-center gap-4' }"
        data-testid="classes-empty"
      >
        <div class="size-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <UIcon
            name="i-lucide-school"
            class="size-8"
          />
        </div>
        <div>
          <h1 class="text-xl sm:text-2xl font-bold text-highlighted">
            {{ t('classes.emptyTitle') }}
          </h1>
          <p class="text-muted mt-1 max-w-md">
            {{ t('classes.emptyText') }}
          </p>
        </div>
        <ul class="flex flex-col gap-2 text-sm text-toned text-start">
          <li
            v-for="n in 3"
            :key="n"
            class="flex gap-2"
          >
            <UIcon
              name="i-lucide-check"
              class="size-4 mt-0.5 shrink-0 text-success"
            />{{ t(`teach.point${n}`) }}
          </li>
        </ul>
        <UButton
          :label="t('classes.createFirst')"
          icon="i-lucide-plus"
          size="lg"
          data-testid="create-first-class"
          @click="startCreate"
        />
      </UCard>

      <template v-else>
        <div class="flex items-center justify-between gap-2">
          <p class="text-sm text-muted">
            {{ t('classes.free') }}
          </p>
          <USwitch
            v-if="archivedCount"
            v-model="showArchived"
            :label="t('centre.showArchived')"
            size="sm"
          />
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <UCard
            v-for="c in classes"
            :key="c.id"
            :class="c.archived ? 'opacity-60' : ''"
            data-testid="class-card"
          >
            <NuxtLink
              :to="`/classes/${c.id}`"
              class="block"
            >
              <div class="flex items-center gap-2">
                <span class="font-semibold text-highlighted truncate">{{ c.name }}</span>
                <UBadge
                  v-if="c.archived"
                  :label="t('centre.archived')"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                />
              </div>
              <p class="text-xs text-muted mt-1">
                {{ t('centre.students', { n: c.students }, c.students) }} · {{ t('centre.assignments', { n: c.assignments }, c.assignments) }}
              </p>
            </NuxtLink>
            <div
              v-if="!c.archived"
              class="flex flex-wrap items-center gap-2 mt-3"
            >
              <span class="font-mono text-sm text-toned">{{ c.joinCode }}</span>
              <UButton
                :label="t('centre.copyJoinLink')"
                icon="i-lucide-link"
                size="xs"
                color="neutral"
                variant="outline"
                @click="copy(`${site}/join/${c.joinCode}`)"
              />
              <UButton
                :href="telegramShare(c)"
                target="_blank"
                rel="noopener"
                icon="i-simple-icons-telegram"
                size="xs"
                color="neutral"
                variant="ghost"
                :aria-label="t('classes.shareTelegram')"
              />
            </div>
          </UCard>
        </div>
      </template>
    </div>

    <UModal
      v-model:open="creating"
      :title="t('classes.newClass')"
    >
      <template #body>
        <form
          class="grid gap-4"
          @submit.prevent="create"
        >
          <UFormField :label="t('centre.name')">
            <UInput
              v-model="name"
              :placeholder="t('centre.namePlaceholder')"
              class="w-full"
              autofocus
              data-testid="class-name-input"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              :label="t('common.cancel')"
              color="neutral"
              variant="ghost"
              @click="creating = false"
            />
            <UButton
              type="submit"
              :label="t('centre.create')"
              :loading="saving"
              :disabled="!name.trim()"
              data-testid="class-create"
            />
          </div>
        </form>
      </template>
    </UModal>
  </AppPage>
</template>
