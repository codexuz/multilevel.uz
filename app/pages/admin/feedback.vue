<script setup lang="ts">
definePageMeta({ middleware: 'admin', layout: 'admin' })

interface AdminFeedbackItem {
  id: string
  kind: string
  subject: string
  message: string
  pageUrl: string | null
  contact: string | null
  status: string
  adminNote: string | null
  resolvedAt: string | null
  createdAt: string
  userName: string | null
  userEmail: string | null
  userTelegram: string | null
  userRole: string | null
}

interface AdminFeedbackPayload {
  counts: { total: number, open: number, inProgress: number, resolved: number }
  items: AdminFeedbackItem[]
}

const { t } = useI18n()
const toast = useToast()

useSeoMeta({ title: () => t('support.adminTitle'), robots: 'noindex' })

const statusFilter = ref<string>('all')
const kindFilter = ref<string>('all')

const queryParams = computed(() => ({
  status: statusFilter.value === 'all' ? undefined : statusFilter.value,
  kind: kindFilter.value === 'all' ? undefined : kindFilter.value
}))

const { data, status, refresh } = await useFetch<AdminFeedbackPayload>('/api/admin/feedback', {
  query: queryParams,
  default: () => ({ counts: { total: 0, open: 0, inProgress: 0, resolved: 0 }, items: [] })
})

const drafts = reactive<Record<string, { status: string, adminNote: string }>>({})
const savingId = ref<string | null>(null)

watch(() => data.value?.items, (items) => {
  if (!items) return
  for (const item of items) {
    drafts[item.id] = {
      status: item.status,
      adminNote: item.adminNote ?? ''
    }
  }
}, { immediate: true })

const statusOptions = computed(() => [
  { label: t('support.statusOpen'), value: 'open' },
  { label: t('support.statusInProgress'), value: 'in_progress' },
  { label: t('support.statusResolved'), value: 'resolved' },
  { label: t('support.statusClosed'), value: 'closed' }
])

const kindFilterItems = computed(() => [
  { label: t('support.allKinds'), value: 'all' },
  { label: t('support.kindBug'), value: 'bug' },
  { label: t('support.kindFeedback'), value: 'feedback' },
  { label: t('support.kindFeature'), value: 'feature' },
  { label: t('support.kindQuestion'), value: 'question' }
])

const statusFilterItems = computed(() => [
  { label: t('support.allStatuses'), value: 'all' },
  ...statusOptions.value
])

function kindMeta(kind: string) {
  if (kind === 'bug') return { label: t('support.kindBug'), icon: 'i-lucide-bug', color: 'error' as const }
  if (kind === 'feature') return { label: t('support.kindFeature'), icon: 'i-lucide-lightbulb', color: 'warning' as const }
  if (kind === 'question') return { label: t('support.kindQuestion'), icon: 'i-lucide-help-circle', color: 'info' as const }
  return { label: t('support.kindFeedback'), icon: 'i-lucide-message-square-heart', color: 'primary' as const }
}

function statusMeta(st: string) {
  if (st === 'in_progress') return { label: t('support.statusInProgress'), color: 'warning' as const }
  if (st === 'resolved') return { label: t('support.statusResolved'), color: 'success' as const }
  if (st === 'closed') return { label: t('support.statusClosed'), color: 'neutral' as const }
  return { label: t('support.statusOpen'), color: 'info' as const }
}

async function saveItem(id: string) {
  const draft = drafts[id]
  if (!draft) return
  savingId.value = id
  try {
    await $fetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      body: {
        status: draft.status,
        adminNote: draft.adminNote.trim() || null
      }
    })
    toast.add({ title: t('support.savedToast'), color: 'success', icon: 'i-lucide-check' })
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    savingId.value = null
  }
}

const formatDate = (iso: string) => localeDate(iso, intlLocale())
</script>

<template>
  <AppPage
    :title="t('support.adminTitle')"
    icon="i-lucide-inbox"
    wide
  >
    <UContainer class="max-w-5xl px-0 flex flex-col gap-5 min-w-0">
      <UPageHeader
        :title="t('support.adminTitle')"
        :description="t('support.adminSubtitle')"
        :ui="{ root: 'border-0 py-0', title: 'text-2xl sm:text-3xl', description: 'text-sm mt-1' }"
      />

      <UPageGrid class="grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        <StatTile
          :label="t('support.statTotal')"
          :value="data.counts.total"
          icon="i-lucide-inbox"
          color="primary"
        />
        <StatTile
          :label="t('support.statOpen')"
          :value="data.counts.open"
          icon="i-lucide-circle-dot"
          color="info"
        />
        <StatTile
          :label="t('support.statInProgress')"
          :value="data.counts.inProgress"
          icon="i-lucide-clock"
          color="warning"
        />
        <StatTile
          :label="t('support.statResolved')"
          :value="data.counts.resolved"
          icon="i-lucide-circle-check"
          color="success"
        />
      </UPageGrid>

      <UCard
        variant="subtle"
        :ui="{ body: 'p-3.5 flex flex-wrap items-center gap-3' }"
      >
        <USelect
          v-model="statusFilter"
          :items="statusFilterItems"
          class="w-full sm:w-48"
        />
        <USelect
          v-model="kindFilter"
          :items="kindFilterItems"
          class="w-full sm:w-48"
        />
      </UCard>

      <USkeleton
        v-if="status === 'pending' && !data.items.length"
        class="h-40 w-full rounded-xl"
      />

      <UPageList
        v-else-if="data.items.length"
        class="gap-4"
      >
        <UCard
          v-for="item in data.items"
          :key="item.id"
          variant="outline"
          :ui="{
            header: 'p-4 flex flex-wrap items-start justify-between gap-2',
            body: 'p-4 flex flex-col gap-3',
            footer: 'p-4 flex flex-col gap-3'
          }"
        >
          <template #header>
            <UUser
              :name="item.userName || item.contact || t('support.guestLabel')"
              :description="[...new Set([item.userEmail, item.userTelegram ? `@${item.userTelegram.replace(/^@/, '')}` : null, item.contact].filter(Boolean))].join(' · ') || undefined"
              :avatar="{ icon: 'i-lucide-user' }"
              size="sm"
              class="min-w-0 flex-1"
              :ui="{ wrapper: 'min-w-0', name: 'break-words', description: 'break-words' }"
            />
            <UPageList class="flex-row flex-wrap items-center gap-1.5 shrink-0">
              <UBadge
                :label="kindMeta(item.kind).label"
                :icon="kindMeta(item.kind).icon"
                :color="kindMeta(item.kind).color"
                variant="subtle"
                size="xs"
              />
              <UBadge
                :label="statusMeta(item.status).label"
                :color="statusMeta(item.status).color"
                variant="soft"
                size="xs"
              />
              <UBadge
                :label="formatDate(item.createdAt)"
                color="neutral"
                variant="outline"
                size="xs"
              />
            </UPageList>
          </template>

          <UPageHeader
            :title="item.subject"
            :description="item.message"
            :ui="{
              root: 'border-0 py-0',
              wrapper: 'min-w-0',
              title: 'text-base sm:text-base break-words',
              description: 'text-sm mt-1 whitespace-pre-line break-words'
            }"
          />

          <UBadge
            v-if="item.pageUrl"
            :label="item.pageUrl"
            icon="i-lucide-link"
            color="neutral"
            variant="subtle"
            size="sm"
            class="self-start max-w-full"
            :ui="{ label: 'whitespace-normal break-all text-start' }"
          />

          <template
            v-if="drafts[item.id]"
            #footer
          >
            <UFormField :label="t('support.adminNoteLabel')">
              <UTextarea
                v-model="drafts[item.id]!.adminNote"
                :placeholder="t('support.adminNotePlaceholder')"
                :rows="2"
                autoresize
                class="w-full"
              />
            </UFormField>

            <UPageList class="flex-row flex-wrap items-center justify-between gap-2">
              <USelect
                v-model="drafts[item.id]!.status"
                :items="statusOptions"
                class="w-full sm:w-48"
              />
              <UButton
                :label="t('support.saveUpdate')"
                icon="i-lucide-save"
                size="sm"
                :loading="savingId === item.id"
                class="w-full sm:w-auto justify-center"
                @click="saveItem(item.id)"
              />
            </UPageList>
          </template>
        </UCard>
      </UPageList>

      <UCard v-else>
        <UEmpty
          icon="i-lucide-inbox"
          :title="t('support.noItems')"
          variant="naked"
        />
      </UCard>
    </UContainer>
  </AppPage>
</template>
