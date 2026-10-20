export function usePreventLeave(enabled: MaybeRefOrGetter<boolean>) {
  const handler = (e: BeforeUnloadEvent) => {
    if (!toValue(enabled)) return
    e.preventDefault()
    e.returnValue = ''
  }
  onMounted(() => window.addEventListener('beforeunload', handler))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', handler))
}
