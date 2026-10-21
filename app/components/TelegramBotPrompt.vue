<script setup lang="ts">
/**
 * Asks a signed-in user who has not joined the Telegram bot to join it: a few seconds after a page
 * opens, at most once every few days. The button opens the bot with a link that connects their
 * account when they press Start; the popup waits for that and closes itself.
 */
const { me, loggedIn, refresh } = useMe()
const toast = useToast()
const { data: providers } = useFetch<{ telegram: { botId: string } | null }>('/api/auth/providers', { key: 'auth-providers' })

const DISMISS_KEY = 'ml.tgBot.dismissedAt'
const QUIET_DAYS = 3
const open = ref(false)
const link = ref<{ url: string, username: string } | null>(null)
const waiting = ref(false)
let showTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setTimeout> | undefined

const needed = computed(() => loggedIn.value && !!me.value && !me.value.telegramBot && !!providers.value?.telegram)

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return !!at && Date.now() - at < QUIET_DAYS * 86_400_000
  } catch {
    return false
  }
}

async function show() {
  if (!needed.value || dismissedRecently()) return
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
function waitForStart(tries = 40) {
  waiting.value = true
  clearTimeout(pollTimer)
  pollTimer = setTimeout(async () => {
    await refresh()
    if (me.value?.telegramBot) {
      waiting.value = false
      open.value = false
      toast.add({ title: 'Telegram connected', description: 'Your results will come to the bot.', icon: 'i-logos-telegram', color: 'success' })
    } else if (tries > 1) waitForStart(tries - 1)
    else waiting.value = false
  }, 3000)
}

function notNow() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    // Private mode: it may ask again next time.
  }
  clearTimeout(pollTimer)
  waiting.value = false
  open.value = false
}

const perks = [
  { icon: 'i-lucide-pen-line', text: 'The moment an examiner marks your Writing or Speaking' },
  { icon: 'i-lucide-sparkles', text: 'When your AI feedback is ready' },
  { icon: 'i-lucide-gift', text: 'When a friend you invited earns you credits' }
]
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
              Get your results in Telegram
            </h2>
            <p class="text-sm text-muted text-pretty">
              Join our bot{{ link ? ` @${link.username}` : '' }} and it messages you:
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
          title="Press Start in Telegram"
          description="Then come back here: this closes by itself once you are connected."
        />
        <div class="grid gap-2">
          <UButton
            :to="link?.url"
            target="_blank"
            external
            size="lg"
            icon="i-logos-telegram"
            :label="waiting ? 'Open the bot again' : 'Join the bot'"
            class="justify-center"
            @click="waitForStart()"
          />
          <UButton
            label="Not now"
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
