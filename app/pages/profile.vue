<script setup lang="ts">
import type { Order } from '~/utils/billing'

/** Who is signed in, their plan, their goals, and how their marked sections have gone. */
useSeoMeta({ title: 'Profile', robots: 'noindex' })
const { me, isPremium, credits } = useMe()
const { data: purchases } = await useFetch<Order[]>('/api/me/orders', { default: () => [] })

const { data } = await useFetch<{ items: { skill: string, score: number | null, status: string }[], total: number }>('/api/me/attempts', { query: { limit: 100 } })
const best = computed(() => {
  const out: Record<string, number> = {}
  for (const a of data.value?.items ?? []) if (a.score != null) out[a.skill] = Math.max(out[a.skill] ?? 0, a.score)
  return out
})
</script>

<template>
  <AppPage
    title="Profile"
    icon="i-lucide-user"
  >
    <div class="flex flex-col gap-6 max-w-3xl">
      <div class="flex items-center gap-4">
        <UAvatar
          :src="me?.avatarUrl || undefined"
          :alt="me?.name || 'User'"
          size="xl"
        />
        <div>
          <h1 class="text-2xl font-bold text-highlighted">
            {{ me?.name || 'Your profile' }}
          </h1>
          <p class="text-muted text-sm">
            {{ me?.email }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          v-for="skill in (['LISTENING', 'READING', 'WRITING', 'SPEAKING'] as const)"
          :key="skill"
          :label="`Best ${SKILL_META[skill].label}`"
          :value="best[skill] != null ? `${best[skill]} / 75` : '—'"
          :icon="SKILL_META[skill].icon"
          color="neutral"
        />
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <h2 class="font-semibold flex items-center gap-2">
              <UIcon
                name="i-lucide-sparkles"
                class="text-primary"
              />Plan
            </h2>
            <UButton
              to="/pricing"
              :label="isPremium ? 'Extend' : 'Get Premium'"
              size="sm"
              :variant="isPremium ? 'outline' : 'solid'"
              :color="isPremium ? 'neutral' : 'primary'"
            />
          </div>
        </template>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-muted">
              Premium
            </dt><dd class="font-medium">
              {{ isPremium ? (me?.premiumUntil ? `Until ${formatDate(me.premiumUntil)}` : 'On') : 'Free plan' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Markings left
            </dt><dd class="font-medium tabular-nums">
              {{ credits }}
            </dd>
          </div>
        </dl>
        <template
          v-if="purchases?.length"
          #footer
        >
          <p class="text-xs font-medium text-muted mb-2">
            Purchases
          </p>
          <ul class="divide-y divide-default text-sm">
            <li
              v-for="o in purchases"
              :key="o.id"
              class="py-2 flex items-center gap-3"
            >
              <span class="flex-1 min-w-0 truncate">{{ o.planName }}</span>
              <span class="text-muted tabular-nums max-sm:hidden">{{ formatDate(o.paidAt || o.createdAt) }}</span>
              <span class="tabular-nums">{{ fmtUzs(o.amountUzs) }}</span>
              <UBadge
                :label="ORDER_STATUS[o.status].label"
                :color="ORDER_STATUS[o.status].color"
                variant="subtle"
                size="sm"
              />
            </li>
          </ul>
        </template>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">
            Goals
          </h2>
        </template>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="text-muted">
              Current level
            </dt><dd class="font-medium">
              {{ me?.currentLevel || '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Target
            </dt><dd class="font-medium">
              {{ me?.targetLevel || (me?.targetScore != null ? `${me.targetScore} / 75` : '—') }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Learning for
            </dt><dd class="font-medium">
              {{ me?.learningDuration || '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Sections taken
            </dt><dd class="font-medium">
              {{ data?.total ?? 0 }}
            </dd>
          </div>
        </dl>
      </UCard>

      <div class="flex gap-2">
        <UButton
          to="/results"
          label="My results"
          icon="i-lucide-chart-column"
        />
        <UButton
          to="/tests"
          label="Take a test"
          icon="i-lucide-clipboard-list"
          color="neutral"
          variant="outline"
        />
      </div>
    </div>
  </AppPage>
</template>
