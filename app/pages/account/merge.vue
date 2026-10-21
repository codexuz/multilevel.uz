<script setup lang="ts">
/**
 * Combining two accounts of the same person (one made with Google, one with Telegram): what the
 * other account brings, and a confirmation. Reached from Profile's Connect buttons, onboarding, or
 * the bot when someone presses Start from the "wrong" account. The link carries a signed token.
 */
const { t: tr } = useI18n()
useSeoMeta({ title: () => tr('merge.title'), robots: 'noindex' })

interface Preview { name: string | null, email: string | null, telegramUsername: string | null, telegram: boolean, createdAt: string, results: number, purchases: number }

const route = useRoute()
const toast = useToast()
const { me } = useMe()
const token = String(route.query.token ?? '')
const { data, error } = await useFetch<{ other: Preview | null, conflict: string | null }>('/api/account/merge', { query: { token } })

const merging = ref(false)
async function merge() {
  merging.value = true
  try {
    await $fetch('/api/account/merge', { method: 'POST', body: { token } })
    toast.add({ title: tr('merge.done'), description: tr('merge.doneText'), color: 'success' })
    reloadNuxtApp({ path: '/profile' })
  } catch (e: any) {
    toast.add({ title: tr('merge.notDone'), description: e?.data?.message || tr('test.tryAgain'), color: 'error' })
    merging.value = false
  }
}

const otherHandle = computed(() => data.value?.other ? accountHandle(data.value.other) : '')
const plural = (n: number, one: 'result' | 'purchase') => tr(`merge.${one}s`, { n }, n)
</script>

<template>
  <AppPage
    :title="tr('merge.title')"
    icon="i-lucide-combine"
    back="/profile"
  >
    <div class="max-w-xl w-full flex flex-col gap-5">
      <UEmpty
        v-if="error || !data?.other"
        icon="i-lucide-link-2-off"
        :title="tr('merge.badLink')"
        :description="error?.data?.message || tr('merge.gone')"
        :actions="[{ label: tr('merge.backToProfile'), to: '/profile', color: 'neutral', variant: 'outline' }]"
      />
      <template v-else>
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
            <i18n-t
              keypath="merge.heading"
              scope="global"
            >
              <template #accent>
                <span class="text-accent">{{ tr('merge.headingAccent') }}</span>
              </template>
            </i18n-t>
          </h1>
          <p class="text-muted mt-1 text-pretty">
            {{ tr('merge.intro') }}
          </p>
        </div>

        <div class="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
          <UCard :ui="{ body: 'flex items-center gap-3' }">
            <UAvatar
              :alt="data.other.name || otherHandle"
              size="md"
            />
            <div class="min-w-0">
              <p class="text-xs text-muted">
                {{ tr('merge.other') }}
              </p>
              <p class="font-semibold text-highlighted truncate">
                {{ data.other.name || otherHandle }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ otherHandle }}
              </p>
              <p class="text-xs text-muted mt-1">
                {{ plural(data.other.results, 'result') }} · {{ plural(data.other.purchases, 'purchase') }}
              </p>
            </div>
          </UCard>
          <UIcon
            name="i-lucide-arrow-right"
            class="size-5 text-dimmed justify-self-center max-sm:rotate-90"
          />
          <UCard :ui="{ body: 'flex items-center gap-3' }">
            <UAvatar
              :src="me?.avatarUrl || undefined"
              :alt="me?.name || 'You'"
              size="md"
            />
            <div class="min-w-0">
              <p class="text-xs text-muted">
                {{ tr('merge.kept') }}
              </p>
              <p class="font-semibold text-highlighted truncate">
                {{ me?.name || accountHandle(me) }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ accountHandle(me) }}
              </p>
            </div>
          </UCard>
        </div>

        <UAlert
          v-if="data.conflict"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="tr('merge.cannot')"
          :description="data.conflict"
        />
        <template v-else>
          <ul class="flex flex-col gap-2 text-sm text-toned">
            <li
              v-for="t in [tr('merge.point1'), tr('merge.point2'), tr('merge.point3')]"
              :key="t"
              class="flex gap-2.5"
            >
              <UIcon
                name="i-lucide-check"
                class="size-5 text-success shrink-0"
              />{{ t }}
            </li>
          </ul>
          <div class="grid gap-2 sm:flex">
            <UButton
              :label="tr('merge.title')"
              icon="i-lucide-combine"
              size="lg"
              :loading="merging"
              class="justify-center"
              @click="merge"
            />
            <UButton
              to="/profile"
              :label="tr('merge.keepApart')"
              color="neutral"
              variant="ghost"
              size="lg"
              class="justify-center"
            />
          </div>
        </template>
      </template>
    </div>
  </AppPage>
</template>
