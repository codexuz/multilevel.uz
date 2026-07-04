<script setup lang="ts">
import type { Database, Profile, Subscription } from '~/types/database.types'
import type { UserRole } from '~/types/exam'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabaseClient<Database>()
const toast = useToast()

const { data, refresh } = await useAsyncData('admin-users', async () => {
  const [{ data: profiles }, { data: subs }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('subscriptions').select('*').eq('status', 'active')
  ])
  return { profiles: (profiles as Profile[]) ?? [], subs: (subs as Subscription[]) ?? [] }
})

const roles: UserRole[] = ['student', 'examiner', 'admin']

function activeSub(userId: string) {
  return data.value?.subs.find((s) => {
    if (s.user_id !== userId || s.plan !== 'premium') return false
    return !s.current_period_end || new Date(s.current_period_end) > new Date()
  })
}

async function setRole(p: Profile, role: UserRole) {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', p.id)
  if (error) return toast.add({ title: error.message, color: 'error' })
  toast.add({ title: `Role updated to ${role}`, color: 'success' })
  await refresh()
}

async function grantPremium(p: Profile, days = 30) {
  const end = new Date(Date.now() + days * 86400000).toISOString()
  const { error } = await supabase.from('subscriptions').insert({
    user_id: p.id, plan: 'premium', status: 'active', current_period_end: end, provider: 'manual'
  })
  if (error) return toast.add({ title: error.message, color: 'error' })
  toast.add({ title: `Premium granted for ${days} days`, color: 'success' })
  await refresh()
}

async function revokePremium(p: Profile) {
  const { error } = await supabase.from('subscriptions')
    .update({ status: 'expired' })
    .eq('user_id', p.id)
    .eq('status', 'active')
  if (error) return toast.add({ title: error.message, color: 'error' })
  toast.add({ title: 'Premium revoked', color: 'success' })
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold">
      Users
    </h1>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <div class="divide-y divide-default">
        <div
          v-for="p in data?.profiles"
          :key="p.id"
          class="flex flex-wrap items-center gap-4 p-4"
        >
          <UAvatar
            :src="p.avatar_url || undefined"
            :alt="p.full_name || 'User'"
            size="md"
          />
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">
              {{ p.full_name || 'Unnamed user' }}
            </p>
            <p class="text-xs text-muted">
              Joined {{ new Date(p.created_at).toLocaleDateString() }}
            </p>
          </div>

          <USelect
            :model-value="p.role"
            :items="roles"
            class="w-32"
            @update:model-value="setRole(p, $event as UserRole)"
          />

          <UBadge
            v-if="activeSub(p.id)"
            color="primary"
            variant="subtle"
            icon="i-lucide-sparkles"
            label="Premium"
          />
          <UButton
            v-if="activeSub(p.id)"
            size="sm"
            color="error"
            variant="ghost"
            label="Revoke"
            @click="revokePremium(p)"
          />
          <UButton
            v-else
            size="sm"
            color="primary"
            variant="soft"
            icon="i-lucide-sparkles"
            label="Grant 30d"
            @click="grantPremium(p, 30)"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
