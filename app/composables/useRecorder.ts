/**
 * Simple microphone recorder built on MediaRecorder. Produces an audio Blob that
 * can be uploaded to S3 via useS3Upload.
 */
export function useRecorder() {
  const recording = ref(false)
  const elapsed = ref(0)
  const blob = ref<Blob | null>(null)
  const url = ref<string | null>(null)
  const error = ref<string | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  async function start() {
    error.value = null
    blob.value = null
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = null
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks = []
      mediaRecorder.ondataavailable = e => e.data.size && chunks.push(e.data)
      mediaRecorder.onstop = () => {
        blob.value = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
        url.value = URL.createObjectURL(blob.value)
        stream?.getTracks().forEach(t => t.stop())
      }
      mediaRecorder.start()
      recording.value = true
      elapsed.value = 0
      timer = setInterval(() => (elapsed.value += 1), 1000)
    } catch (e) {
      error.value = (e as Error).message || 'Microphone access denied'
    }
  }

  function stop() {
    if (mediaRecorder && recording.value) {
      mediaRecorder.stop()
      recording.value = false
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }

  onBeforeUnmount(() => {
    stop()
    if (url.value) URL.revokeObjectURL(url.value)
  })

  return { recording, elapsed, blob, url, error, start, stop }
}
