<script setup lang="ts">
/**
 * Combining two accounts of the same person (one made with Google, one with Telegram): what the
 * other account brings, and a confirmation. Reached from Profile's Connect buttons, onboarding, or
 * the bot when someone presses Start from the "wrong" account. The link carries a signed token.
 */
useSeoMeta({ title: 'Combine accounts', robots: 'noindex' })

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
    toast.add({ title: 'Accounts combined', description: 'Everything is in this account now.', color: 'success' })
    reloadNuxtApp({ path: '/profile' })
  } catch (e: any) {
    toast.add({ title: 'Not combined', description: e?.data?.message || 'Please try again.', color: 'error' })
    merging.value = false
  }
}

const otherHandle = computed(() => data.value?.other ? accountHandle(data.value.other) : '')
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`
</script>

<template>
  <AppPage
    title="Combine accounts"
    icon="i-lucide-combine"
    back="/profile"
  >
    <div class="max-w-xl w-full flex flex-col gap-5">
      <UEmpty
        v-if="error || !data?.other"
        icon="i-lucide-link-2-off"
        title="This link cannot be used"
        :description="error?.data?.message || 'That account no longer exists.'"
        :actions="[{ label: 'Back to Profile', to: '/profile', color: 'neutral', variant: 'outline' }]"
      />
      <template v-else>
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
            Combine your <span class="text-accent">accounts</span>
          </h1>
          <p class="text-muted mt-1 text-pretty">
            You have a second Multilevel account. Bring it into this one, so your results, Premium and credits are in one place and both ways of signing in open it.
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
                Other account
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
                This account (kept)
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
          title="These two cannot be combined"
          :description="data.conflict"
        />
        <template v-else>
          <ul class="flex flex-col gap-2 text-sm text-toned">
            <li
              v-for="t in ['Results, AI feedback, purchases, Premium days, credits and opened tests move to this account.', 'You can sign in to this account with both Google and Telegram.', 'The other account is removed. This cannot be undone.']"
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
              label="Combine accounts"
              icon="i-lucide-combine"
              size="lg"
              :loading="merging"
              class="justify-center"
              @click="merge"
            />
            <UButton
              to="/profile"
              label="Keep them apart"
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
