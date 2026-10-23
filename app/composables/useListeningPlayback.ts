/**
 * The Listening recording, played once: the section's full recording when the test has one;
 * otherwise each part's own recording, one after another, the paper moving to each part as its
 * recording begins (as the exam's own audio does). A part without a recording, or one that will
 * not play, is skipped; a full recording that will not load gives way to the parts' own.
 * `done` runs when the last one ends (review time begins).
 */
export function useListeningPlayback(opts: {
  fullUrl: () => string | null | undefined
  partUrls: () => Record<number, string> | undefined
  partCount: () => number
  onPart: (index: number) => void
  done: () => void
}) {
  const playing = ref(false)
  /** The part whose recording is playing (null with the full recording). */
  const playingPart = ref<number | null>(null)
  let audio: HTMLAudioElement | null = null
  let stopped = false

  function stop() {
    stopped = true
    audio?.pause()
    audio = null
    playing.value = false
  }

  function finish() {
    playing.value = false
    playingPart.value = null
    audio = null
    if (!stopped) opts.done()
  }

  /** Plays `url`; `next` follows when it ends, `failed` (else `next`) if it cannot be played. */
  function play(url: string, next: () => void, failed = next) {
    audio?.pause()
    const clip = new Audio(url)
    audio = clip
    let moved = false
    const onward = (then: () => void) => {
      if (moved || stopped || audio !== clip) return
      moved = true
      then()
    }
    clip.addEventListener('ended', () => onward(next))
    clip.addEventListener('error', () => onward(failed))
    clip.play().catch((e) => {
      console.error(e)
      // A file that cannot be loaded moves on; a play the browser blocked waits for the error or the end.
      if (clip.error) onward(failed)
    })
  }

  /** The parts' recordings from `index` on, skipping parts without one. */
  function playFrom(index: number) {
    const urls = opts.partUrls() ?? {}
    const count = opts.partCount()
    let i = index
    while (i < count && !urls[i]) i++
    if (i >= count) return finish()
    playingPart.value = i
    opts.onPart(i)
    play(urls[i]!, () => playFrom(i + 1))
  }

  /** Starts the recording; false when there is none at all (review time at once). */
  function start() {
    stopped = false
    const full = opts.fullUrl()
    const urls = opts.partUrls() ?? {}
    const hasParts = Object.values(urls).some(Boolean)
    if (full) {
      playing.value = true
      play(full, finish, hasParts ? () => playFrom(0) : finish)
      return true
    }
    if (!hasParts) {
      opts.done()
      return false
    }
    playing.value = true
    playFrom(0)
    return true
  }

  onBeforeUnmount(stop)
  return { playing, playingPart, start, stop }
}
