<script setup lang="ts">
/**
 * Asks a signed-in user who has not joined the Telegram bot to join it: a few seconds after a page
 * opens, at most once every few days, and only after the server has checked with Telegram that the
 * bot really cannot write to them yet. The button opens the bot with a link that connects their
 * account when they press Start; the popup waits for that and closes itself.
 */
const { t } = useI18n()
const { me, loggedIn, refresh } = useMe()
const toast = useToast()
const { data: providers } = useFetch<{ telegram: { botId: string } | null }>('/api/auth/providers', { key: 'auth-providers' })

const DISMISS_KEY = 'ml.tgBot.quietUntil'
/** "Not now": three days; after "Join the bot": a day, in case joining was not noticed. */
const QUIET_NOT_NOW = 3 * 86_400_000
const QUIET_AFTER_JOIN = 86_400_000
const open = ref(false)
const link = ref<{ url: string, username: string } | null>(null)
const waiting = ref(false)
let showTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined

const needed = computed(() => loggedIn.value && !!me.value && !me.value.telegramBot && !!providers.value?.telegram)

function quiet() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY)) > Date.now()
  } catch {
    return false
  }
}
function keepQuiet(ms: number) {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + ms))
  } catch {
    // Private mode: it may ask again next time.
  }
}

/** Asks the server, which asks Telegram, whether the bot can write to this user yet. */
async function joined() {
  const res = await $fetch<{ joined: boolean }>('/api/telegram/status').catch(() => null)
  if (res?.joined) await refresh()
  return !!res?.joined
}

async function show() {
  if (!needed.value || quiet() || await joined()) return
  link.value = await $fetch<{ url: string, username: string }>('/api/telegram/link').catch(() => null)
  if (link.value && needed.value) open.value = true
}

onMounted(() => {
  watch(needed, (n) => {
    clearTimeout(showTimer)
    if (n) showTimer = setTimeout(show, 4000)
  }, { immediate: true })
})
onBeforeUnmount(() => {
  clearTimeout(showTimer)
  clearTimeout(pollTimer)
})

/** After the bot opens: check every few seconds (for two minutes) whether Start was pressed. */
function waitForStart(tries = 30) {
  if (!waiting.value) keepQuiet(QUIET_AFTER_JOIN)
  waiting.value = true
  clearTimeout(pollTimer)
  pollTimer = setTimeout(async () => {
    if (await joined()) {
      waiting.value = false
      open.value = false
      toast.add({ title: t('bot.connected'), description: t('bot.connectedText'), icon: 'i-logos-telegram', color: 'success' })
    } else if (tries > 1) waitForStart(tries - 1)
    else waiting.value = false
  }, 4000)
}

function notNow() {
  keepQuiet(QUIET_NOT_NOW)
  clearTimeout(pollTimer)
  waiting.value = false
  open.value = false
}

const perks = computed(() => [
  { icon: 'i-lucide-pen-line', text: t('bot.perkMarked') },
  { icon: 'i-lucide-sparkles', text: t('bot.perkAi') },
  { icon: 'i-lucide-gift', text: t('bot.perkInvite') }
])
</script>

<template>
  <UModal
    v-model:open="open"
    :dismissible="false"
    :close="false"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #content>
      <div class="p-6 flex flex-col gap-5">
        <div class="flex items-start gap-4">
          <div class="size-14 shrink-0 rounded-2xl bg-[#27a6e5]/10 grid place-items-center">
            <UIcon
              name="i-logos-telegram"
              class="size-8"
            />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-highlighted">
              {{ t('bot.title') }}
            </h2>
            <p class="text-sm text-muted text-pretty">
              {{ t('bot.intro', { bot: link ? ` @${link.username}` : '' }) }}
            </p>
          </div>
        </div>
        <ul class="flex flex-col gap-2.5">
          <li
            v-for="p in perks"
            :key="p.text"
            class="flex items-center gap-3 text-sm text-toned"
          >
            <UIcon
              :name="p.icon"
              class="size-5 text-primary shrink-0"
            />{{ p.text }}
          </li>
        </ul>
        <UAlert
          v-if="waiting"
          color="info"
          variant="subtle"
          icon="i-lucide-loader-circle"
          :ui="{ icon: 'animate-spin' }"
          :title="t('bot.pressStart')"
          :description="t('bot.pressStartText')"
        />
        <div class="grid gap-2">
          <UButton
            :to="link?.url"
            target="_blank"
            external
            size="lg"
            icon="i-logos-telegram"
            :label="waiting ? t('bot.openAgain') : t('bot.join')"
            class="justify-center"
            @click="waitForStart()"
          />
          <UButton
            :label="t('bot.notNow')"
            color="neutral"
            variant="ghost"
            class="justify-center"
            @click="notNow"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
