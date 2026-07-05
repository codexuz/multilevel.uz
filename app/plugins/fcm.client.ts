// Registers the current device for push once the user is signed in.
export default defineNuxtPlugin(() => {
  const { loggedIn } = useMe()
  const { enable } = useFcm()

  watch(loggedIn, (isIn) => {
    if (isIn) enable()
  }, { immediate: true })
})
