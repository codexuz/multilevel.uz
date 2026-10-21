<script setup lang="ts">
/**
 * Telegram messages from the bot: whether they are on, and the way to join the bot (which also
 * connects Telegram to a Google account). On Settings, and on Profile on a phone.
 */
const { t } = useI18n()
const toast = useToast()
const { me, refresh: refreshMe } = useMe()

/** Telegram messages from the bot; only for an account with Telegram connected. */
const savingNotify = ref(false)
const joining = ref(false)
/** Opens the bot with a link that connects this account when Start is pressed. */
async function joinBot() {
  joining.value = true
  try {
    const { url } = await $fetch<{ url: string }>('/api/telegram/link')
    window.open(url, '_blank', 'noopener')
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 4000))
      if ((await $fetch<{ joined: boolean }>('/api/telegram/status').catch(() => null))?.joined) break
    }
    await refreshMe()
  } catch {
    toast.add({ title: t('bot.unavailable'), color: 'error' })
  } finally {
    joining.value = false
  }
}
async function setTelegramNotify(on: boolean) {
  savingNotify.value = true
  try {
    await $fetch('/api/me/notifications', { method: 'PATCH', body: { telegram: on } })
    await refreshMe()
  } catch {
    toast.add({ title: t('common.notSaved'), description: t('test.tryAgain'), color: 'error' })
  } finally {
    savingNotify.value = false
  }
}
</script>

<template>
  <UCard>
    <div class="flex items-start gap-4">
      <UIcon
        name="i-logos-telegram"
        class="size-6 shrink-0 mt-0.5"
      />
      <div class="flex-1 min-w-0">
        <p class="font-medium">
          {{ t('bot.messages') }}
        </p>
        <p class="text-sm text-muted text-pretty">
          {{ me?.telegram ? t('bot.messagesText') : t('bot.messagesJoin') }}
        </p>
        <UButton
          v-if="!me?.telegramBot"
          :label="t('bot.join')"
          icon="i-lucide-send"
          size="sm"
          color="neutral"
          variant="outline"
          class="mt-2"
          :loading="joining"
          @click="joinBot"
        />
      </div>
      <USwitch
        :model-value="!!me?.telegram && !!me?.telegramNotify"
        :disabled="!me?.telegram"
        :loading="savingNotify"
        :aria-label="t('bot.messages')"
        @update:model-value="setTelegramNotify"
      />
    </div>
  </UCard>
</template>
