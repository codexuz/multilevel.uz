// Debounce a callback with random jitter added to the delay. The jitter
// decorrelates otherwise-simultaneous autosaves (section + part + questions,
// or many parts at once) so they don't hit the backend in one burst.
export function useDebouncedCallback(fn: () => void, baseMs = 700, jitterMs = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = undefined
  }

  function trigger() {
    cancel()
    timer = setTimeout(fn, baseMs + Math.random() * jitterMs)
  }

  onBeforeUnmount(cancel)

  return { trigger, cancel }
}
