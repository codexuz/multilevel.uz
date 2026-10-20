/**
 * Debounced autosave for an editor form. Call `markClean()` after loading data;
 * any later change schedules `save()`. Pending changes are flushed before unmount.
 */
export function useAutosave(source: () => unknown, save: () => Promise<void>, delay = 1500) {
  const state = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const enabled = ref(false)
  let snapshot = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null

  const serialize = () => JSON.stringify(source())

  function markClean() {
    snapshot = serialize()
    enabled.value = true
    state.value = 'idle'
  }

  async function flush() {
    clearTimeout(timer)
    if (!enabled.value) return
    if (running) await running
    const current = serialize()
    if (current === snapshot) return
    state.value = 'saving'
    running = save()
      .then(() => {
        snapshot = current
        state.value = serialize() === snapshot ? 'saved' : 'dirty'
        if (state.value === 'dirty') schedule()
      })
      .catch(() => {
        state.value = 'error'
      })
      .finally(() => {
        running = null
      })
    await running
  }

  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(flush, delay)
  }

  watch(source, () => {
    if (!enabled.value || state.value === 'saving') return
    if (serialize() === snapshot) return
    state.value = 'dirty'
    schedule()
  }, { deep: true })

  defineShortcuts({ meta_s: { usingInput: true, handler: () => flush() } })

  onBeforeUnmount(() => {
    if (state.value === 'dirty') flush()
    clearTimeout(timer)
  })

  return { state, markClean, flush }
}
