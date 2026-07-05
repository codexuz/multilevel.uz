// Back-compat shim: subscription/premium status now comes from /api/me.
export function useSubscription() {
  const { me, isPremium, refresh } = useMe()
  return { isPremium, subscription: me, refresh }
}
