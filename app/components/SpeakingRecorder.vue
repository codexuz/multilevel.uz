<script setup lang="ts">
defineProps<{ modelValue?: string | null, prepTime?: number, speakTime?: number }>()
const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const rec = useRecorder()
const { upload, uploading } = useS3Upload()
const toast = useToast()

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

async function stopAndUpload() {
  rec.stop()
  // wait a tick for the blob to be assembled
  await new Promise(r => setTimeout(r, 200))
  if (!rec.blob.value) return
  try {
    const url = await upload(rec.blob.value, 'recording')
    emit('update:modelValue', url)
    toast.add({ title: 'Recording saved', color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    toast.add({ title: 'Upload failed', description: (e as Error).message, color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <UButton
        v-if="!rec.recording.value"
        icon="i-lucide-mic"
        color="error"
        label="Record"
        :loading="uploading"
        @click="rec.start()"
      />
      <UButton
        v-else
        icon="i-lucide-square"
        color="neutral"
        label="Stop"
        @click="stopAndUpload()"
      />
      <span
        v-if="rec.recording.value"
        class="flex items-center gap-2 text-error font-mono"
      >
        <span class="size-2 rounded-full bg-error animate-pulse" /> {{ fmt(rec.elapsed.value) }}
      </span>
      <span
        v-if="speakTime"
        class="text-xs text-muted"
      >Suggested: {{ fmt(speakTime) }}</span>
    </div>

    <UAlert
      v-if="rec.error.value"
      color="error"
      variant="subtle"
      :description="rec.error.value"
    />

    <audio
      v-if="modelValue"
      :src="modelValue"
      controls
      class="w-full h-9"
    />
    <p
      v-if="modelValue"
      class="text-xs text-success flex items-center gap-1"
    >
      <UIcon name="i-lucide-check-circle" /> Answer recorded
    </p>
  </div>
</template>
