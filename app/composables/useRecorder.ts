/**
 * Simple microphone recorder built on MediaRecorder. Produces an audio Blob that
 * can be uploaded with uploadFile (services/http).
 *
 * While recording it also samples the input level (`levels`) so a caller can
 * draw a live waveform.
 */
const MAX_LEVELS = 240
const LEVEL_INTERVAL_MS = 80

export function useRecorder() {
  const recording = ref(false)
  const elapsed = ref(0)
  const blob = ref<Blob | null>(null)
  const url = ref<string | null>(null)
  const error = ref<string | null>(null)
  const levels = ref<number[]>([])

  let mediaRecorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let levelTimer: ReturnType<typeof setInterval> | null = null
  let audioCtx: AudioContext | null = null

  function stopMetering() {
    if (levelTimer) {
      clearInterval(levelTimer)
      levelTimer = null
    }
    audioCtx?.close().catch(() => {})
    audioCtx = null
  }

  /** Root-mean-square of the live signal, sampled on a timer. */
  function startMetering(source: MediaStream) {
    try {
      audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      audioCtx.createMediaStreamSource(source).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)

      levelTimer = setInterval(() => {
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (const v of data) {
          const centered = (v - 128) / 128
          sum += centered * centered
        }
        const rms = Math.sqrt(sum / data.length)
        // Scale up: speech RMS sits well below 1.
        levels.value = [...levels.value, Math.min(1, rms * 3)].slice(-MAX_LEVELS)
      }, LEVEL_INTERVAL_MS)
    } catch {
      // Metering is decorative — a failure here must not stop the recording.
    }
  }

  function revoke() {
    if (url.value) {
      URL.revokeObjectURL(url.value)
      url.value = null
    }
  }

  /** Drop the last take so the recorder can be reused. */
  function reset() {
    revoke()
    blob.value = null
    levels.value = []
    elapsed.value = 0
  }

  async function start() {
    error.value = null
    blob.value = null
    levels.value = []
    revoke()
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
        stopMetering()
      }
      mediaRecorder.start()
      startMetering(stream)
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
    stopMetering()
    revoke()
  })

  return { recording, elapsed, blob, url, error, levels, start, stop, reset }
}
