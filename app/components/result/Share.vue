<script setup lang="ts">
/**
 * Sharing a scored result: a picture of it with the sharer's invite link, sent to Telegram, the
 * phone's share sheet (as the picture where it can be), copied as a link, or saved.
 */
const { t } = useI18n()
const props = defineProps<{ attemptId: string }>()
const toast = useToast()

interface Share { url: string, image: string, text: string }
const open = ref(false)
const loading = ref(false)
const share = ref<Share | null>(null)
const canShare = ref(false)
onMounted(() => (canShare.value = typeof navigator !== 'undefined' && !!navigator.share))

async function start() {
  loading.value = true
  try {
    share.value ??= await $fetch<Share>(`/api/attempts/${props.attemptId}/share`, { method: 'POST' })
    open.value = true
  } catch (e: any) {
    toast.add({ title: t('share.cannot'), description: e?.data?.message || t('test.tryAgain'), color: 'warning' })
  } finally {
    loading.value = false
  }
}

// The picture from this site's own address, whatever the site address in the share link says.
const imagePath = computed(() => (share.value ? new URL(share.value.image, window.location.origin).pathname : ''))
const telegram = computed(() => share.value ? `https://t.me/share/url?url=${encodeURIComponent(share.value.url)}&text=${encodeURIComponent(share.value.text)}` : '')

async function imageFile() {
  const blob = await (await fetch(imagePath.value)).blob()
  return new File([blob], 'multilevel-result.png', { type: 'image/png' })
}

async function nativeShare() {
  if (!share.value) return
  try {
    const file = await imageFile().catch(() => null)
    const withFile = file && navigator.canShare?.({ files: [file] })
    await navigator.share(withFile
      ? { files: [file!], text: `${share.value.text} ${share.value.url}` }
      : { title: t('share.myResult'), text: share.value.text, url: share.value.url })
  } catch {
    // Closed without sharing.
  }
}

async function copy() {
  if (!share.value) return
  try {
    await navigator.clipboard.writeText(`${share.value.text} ${share.value.url}`)
    toast.add({ title: t('common.copied'), icon: 'i-lucide-check', color: 'success' })
  } catch {
    toast.add({ title: t('share.copyFromBox'), color: 'neutral' })
  }
}

async function download() {
  try {
    const url = URL.createObjectURL(await imageFile())
    const a = Object.assign(document.createElement('a'), { href: url, download: 'multilevel-result.png' })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    toast.add({ title: t('share.saveFailed'), color: 'error' })
  }
}
</script>

<template>
  <UButton
    :label="t('share.share')"
    icon="i-lucide-share-2"
    color="neutral"
    variant="outline"
    size="lg"
    class="justify-center"
    :loading="loading"
    @click="start"
  />
  <UModal
    v-model:open="open"
    :title="t('share.title')"
    :description="t('share.text')"
  >
    <template #body>
      <div
        v-if="share"
        class="flex flex-col gap-4"
      >
        <img
          :src="imagePath"
          alt="Your result card"
          width="1200"
          height="630"
          class="w-full rounded-lg ring ring-default"
        >
        <div class="grid grid-cols-2 gap-2">
          <UButton
            :to="telegram"
            target="_blank"
            external
            icon="i-logos-telegram"
            label="Telegram"
            color="neutral"
            variant="soft"
            class="justify-center"
          />
          <UButton
            v-if="canShare"
            icon="i-lucide-share"
            :label="t('share.more')"
            color="neutral"
            variant="soft"
            class="justify-center"
            @click="nativeShare"
          />
          <UButton
            icon="i-lucide-copy"
            :label="t('share.copyLink')"
            color="neutral"
            variant="soft"
            class="justify-center"
            @click="copy"
          />
          <UButton
            icon="i-lucide-download"
            :label="t('share.savePicture')"
            color="neutral"
            variant="soft"
            class="justify-center"
            @click="download"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
