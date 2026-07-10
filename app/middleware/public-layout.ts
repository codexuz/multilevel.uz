// Pages that are browsable signed out but also linked from the signed-in app.
// Guests get the marketing shell; members keep their sidebar. `auth.global` has
// already resolved `me` by the time this runs.
export default defineNuxtRouteMiddleware(() => {
  const { me } = useMe()
  if (me.value) setPageLayout('default')
})
