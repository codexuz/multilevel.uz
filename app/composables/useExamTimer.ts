/**
 * Countdown timer for an exam section. Mirrors the behaviour of the legacy
 * examples (startTimer): counts down from N seconds, fires a one-minute warning,
 * then calls onExpire.
 */
export function useExamTimer() {
  const remaining = ref(0)
  const warned = ref(false)
  let interval: ReturnType<typeof setInterval> | null = null
  let onExpire: (() => void) | null = null
  let onWarn: (() => void) | null = null

  const minutes = computed(() => String(Math.floor(remaining.value / 60)).padStart(2, '0'))
  const seconds = computed(() => String(remaining.value % 60).padStart(2, '0'))
  const label = computed(() => `${minutes.value}:${seconds.value}`)
  const danger = computed(() => remaining.value <= 60)

  function start(seconds: number, opts?: { onExpire?: () => void, onWarn?: () => void }) {
    stop()
    remaining.value = Math.max(0, Math.floor(seconds))
    warned.value = false
    onExpire = opts?.onExpire ?? null
    onWarn = opts?.onWarn ?? null
    interval = setInterval(() => {
      remaining.value -= 1
      if (remaining.value === 60 && !warned.value) {
        warned.value = true
        onWarn?.()
      }
      if (remaining.value <= 0) {
        stop()
        onExpire?.()
      }
    }, 1000)
  }

  function stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  onBeforeUnmount(stop)

  return { remaining, minutes, seconds, label, danger, start, stop }
}
