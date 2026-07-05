// Public Firebase web config for the messaging service worker.
export default defineEventHandler(() => {
  const cfg = useRuntimeConfig().public.firebase as Record<string, string>
  return {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId
  }
})
