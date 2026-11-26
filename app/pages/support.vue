<script setup lang="ts">
import type { AccordionItem } from '@nuxt/ui'

definePageMeta({ guestLayout: true })

interface FeedbackSubmission {
  id: string
  kind: 'bug' | 'feedback' | 'feature' | 'question' | string
  subject: string
  message: string
  pageUrl: string | null
  contact: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | string
  adminNote: string | null
  resolvedAt: string | null
  createdAt: string
}

const SUPPORT_HANDLE = '@javlon_developer'
const SUPPORT_TELEGRAM_URL = 'https://t.me/javlon_developer'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const { me, loggedIn } = useMe()

useSeoMeta({
  title: () => t('support.title'),
  description: () => t('support.subtitle')
})

const kindOptions = computed(() => [
  { value: 'bug' as const, label: t('support.kindBug'), icon: 'i-lucide-bug', color: 'error' as const },
  { value: 'feedback' as const, label: t('support.kindFeedback'), icon: 'i-lucide-message-square-heart', color: 'primary' as const },
  { value: 'feature' as const, label: t('support.kindFeature'), icon: 'i-lucide-lightbulb', color: 'warning' as const },
  { value: 'question' as const, label: t('support.kindQuestion'), icon: 'i-lucide-help-circle', color: 'info' as const }
])

const form = reactive({
  kind: 'bug' as 'bug' | 'feedback' | 'feature' | 'question',
  subject: '',
  message: '',
  pageUrl: typeof route.query.from === 'string' ? route.query.from : '',
  contact: ''
})

watch(me, (u) => {
  if (!u || form.contact) return
  if (u.telegramUsername) form.contact = `@${u.telegramUsername.replace(/^@/, '')}`
  else if (u.email) form.contact = u.email
}, { immediate: true })

const submitting = ref(false)
const submittedOk = ref(false)
const formError = ref<string | null>(null)
const copiedHandle = ref(false)

const { data: historyData, status: historyStatus, refresh: refreshHistory } = await useFetch<{ items: FeedbackSubmission[] }>('/api/support/feedback', {
  immediate: loggedIn.value,
  default: () => ({ items: [] })
})

watch(loggedIn, (isIn) => {
  if (isIn) refreshHistory()
})

async function submitReport() {
  formError.value = null
  submittedOk.value = false

  const subject = form.subject.trim()
  const message = form.message.trim()
  if (subject.length < 3) {
    formError.value = t('support.subjectShort')
    return
  }
  if (message.length < 10) {
    formError.value = t('support.messageShort')
    return
  }

  submitting.value = true
  try {
    await $fetch('/api/support/feedback', {
      method: 'POST',
      body: {
        kind: form.kind,
        subject,
        message,
        pageUrl: form.pageUrl.trim() || undefined,
        contact: form.contact.trim() || undefined
      }
    })
    submittedOk.value = true
    form.subject = ''
    form.message = ''
    toast.add({
      title: t('support.sentTitle'),
      color: 'success',
      icon: 'i-lucide-check-circle-2'
    })
    if (loggedIn.value) await refreshHistory()
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    submitting.value = false
  }
}

async function copyHandle() {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(SUPPORT_HANDLE)
    copiedHandle.value = true
    setTimeout(() => (copiedHandle.value = false), 1800)
  } catch {}
}

const faqItems = computed<AccordionItem[]>(() => [
  { label: t('support.faq1Q'), icon: 'i-lucide-bug', content: t('support.faq1A') },
  { label: t('support.faq2Q'), icon: 'i-lucide-lightbulb', content: t('support.faq2A') },
  { label: t('support.faq3Q'), icon: 'i-simple-icons-telegram', content: t('support.faq3A') }
])

function kindMeta(kind: string) {
  if (kind === 'bug') return { label: t('support.kindBug'), icon: 'i-lucide-bug', color: 'error' as const }
  if (kind === 'feature') return { label: t('support.kindFeature'), icon: 'i-lucide-lightbulb', color: 'warning' as const }
  if (kind === 'question') return { label: t('support.kindQuestion'), icon: 'i-lucide-help-circle', color: 'info' as const }
  return { label: t('support.kindFeedback'), icon: 'i-lucide-message-square-heart', color: 'primary' as const }
}

function statusMeta(status: string) {
  if (status === 'in_progress') return { label: t('support.statusInProgress'), color: 'warning' as const, icon: 'i-lucide-clock' }
  if (status === 'resolved') return { label: t('support.statusResolved'), color: 'success' as const, icon: 'i-lucide-circle-check' }
  if (status === 'closed') return { label: t('support.statusClosed'), color: 'neutral' as const, icon: 'i-lucide-archive' }
  return { label: t('support.statusOpen'), color: 'info' as const, icon: 'i-lucide-circle-dot' }
}

const formatDate = (iso: string) => localeDate(iso, intlLocale())
</script>

<template>
  <AppPage
    :title="t('support.title')"
    icon="i-lucide-life-buoy"
    wide
  >
    <UContainer class="max-w-5xl px-0 pb-16 lg:pb-0 flex flex-col gap-5 min-w-0">
      <UPageHeader
        :title="t('support.title')"
        :description="t('support.subtitle')"
        :ui="{
          root: 'border-0 py-0',
          wrapper: 'min-w-0',
          title: 'text-2xl sm:text-3xl break-words',
          description: 'text-sm mt-1.5',
          links: 'w-full sm:w-auto'
        }"
      >
        <template #links>
          <UButton
            :to="SUPPORT_TELEGRAM_URL"
            target="_blank"
            rel="noopener"
            :label="t('support.openTelegram')"
            icon="i-simple-icons-telegram"
            trailing-icon="i-lucide-external-link"
            color="primary"
            size="md"
            class="w-full sm:w-auto justify-center"
            data-testid="support-telegram-cta"
          />
        </template>
      </UPageHeader>

      <UPageGrid class="grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-5 items-start">
        <!-- Left Column: Report & Feedback Form -->
        <UCard
          variant="outline"
          :ui="{
            header: 'p-4 sm:p-5',
            body: 'p-4 sm:p-5 flex flex-col gap-4'
          }"
          data-testid="support-form-card"
        >
          <template #header>
            <UPageHeader
              :title="t('support.formTitle')"
              :description="t('support.formHint')"
              :ui="{ root: 'border-0 py-0', title: 'text-lg sm:text-lg', description: 'text-xs sm:text-sm mt-1' }"
            />
          </template>

          <UAlert
            v-if="submittedOk"
            color="success"
            variant="soft"
            icon="i-lucide-check-circle-2"
            :title="t('support.sentTitle')"
            :description="t('support.sentDescription')"
            data-testid="support-sent-alert"
          />

          <UAlert
            v-if="formError"
            color="error"
            variant="soft"
            icon="i-lucide-alert-circle"
            :description="formError"
          />

          <UFormField :label="t('support.kindLabel')">
            <UPageList class="flex-row flex-wrap items-center gap-2">
              <UButton
                v-for="opt in kindOptions"
                :key="opt.value"
                :label="opt.label"
                :icon="opt.icon"
                :color="form.kind === opt.value ? opt.color : 'neutral'"
                :variant="form.kind === opt.value ? 'solid' : 'outline'"
                size="sm"
                :data-testid="`support-kind-${opt.value}`"
                @click="form.kind = opt.value"
              />
            </UPageList>
          </UFormField>

          <UFormField
            :label="t('support.subjectLabel')"
            required
          >
            <UInput
              v-model="form.subject"
              :placeholder="t('support.subjectPlaceholder')"
              maxlength="160"
              class="w-full"
              data-testid="support-subject"
            />
          </UFormField>

          <UFormField
            :label="t('support.messageLabel')"
            required
          >
            <UTextarea
              v-model="form.message"
              :placeholder="t('support.messagePlaceholder')"
              :rows="5"
              autoresize
              maxlength="3000"
              class="w-full"
              data-testid="support-message"
            />
          </UFormField>

          <UPageGrid class="grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
            <UFormField :label="t('support.pageUrlLabel')">
              <UInput
                v-model="form.pageUrl"
                icon="i-lucide-link"
                :placeholder="t('support.pageUrlPlaceholder')"
                maxlength="300"
                class="w-full"
              />
            </UFormField>

            <UFormField :label="t('support.contactLabel')">
              <UInput
                v-model="form.contact"
                icon="i-lucide-at-sign"
                :placeholder="t('support.contactPlaceholder')"
                maxlength="120"
                class="w-full"
              />
            </UFormField>
          </UPageGrid>

          <UPageList class="flex-row justify-end">
            <UButton
              :label="t('support.submit')"
              icon="i-lucide-send"
              size="md"
              :loading="submitting"
              class="w-full sm:w-auto justify-center"
              data-testid="support-submit"
              @click="submitReport"
            />
          </UPageList>
        </UCard>

        <!-- Right Column: Direct Telegram Support + FAQ -->
        <UPageList class="gap-4">
          <UCard
            variant="subtle"
            :ui="{
              header: 'p-4',
              body: 'p-4 flex flex-col gap-3.5'
            }"
            data-testid="support-telegram-card"
          >
            <template #header>
              <UUser
                :name="t('support.devName')"
                :description="t('support.devRole')"
                :avatar="{
                  icon: 'i-simple-icons-telegram',
                  ui: { root: 'bg-primary/15', icon: 'text-primary' }
                }"
                size="md"
              />
            </template>

            <UPageHeader
              :description="t('support.directDesc')"
              :ui="{ root: 'border-0 py-0', description: 'text-sm mt-0' }"
            />

            <UAlert
              color="info"
              variant="soft"
              icon="i-lucide-sparkles"
              :title="t('support.tipsTitle')"
              :description="t('support.tipsText')"
            />

            <UPageList class="gap-2">
              <UButton
                :to="SUPPORT_TELEGRAM_URL"
                target="_blank"
                rel="noopener"
                :label="t('support.openTelegram')"
                icon="i-simple-icons-telegram"
                trailing-icon="i-lucide-external-link"
                color="primary"
                size="md"
                block
              />
              <UButton
                :label="copiedHandle ? t('support.copied') : t('support.copyHandle')"
                :icon="copiedHandle ? 'i-lucide-check' : 'i-lucide-copy'"
                color="neutral"
                variant="outline"
                size="sm"
                block
                @click="copyHandle"
              />
            </UPageList>
          </UCard>

          <UCard
            variant="outline"
            :ui="{
              header: 'p-4',
              body: 'px-4 py-2'
            }"
          >
            <template #header>
              <UPageHeader
                :title="t('support.faqTitle')"
                :ui="{ root: 'border-0 py-0', title: 'text-base sm:text-base' }"
              />
            </template>
            <UAccordion :items="faqItems" />
          </UCard>
        </UPageList>
      </UPageGrid>

      <!-- User's Own Submissions History (when signed in) -->
      <template v-if="loggedIn">
        <USeparator />

        <UCard
          variant="outline"
          :ui="{
            header: 'p-4 flex items-center justify-between gap-2',
            body: 'p-4 flex flex-col gap-3'
          }"
          data-testid="support-history"
        >
          <template #header>
            <UPageHeader
              :title="t('support.historyTitle')"
              :ui="{ root: 'border-0 py-0', title: 'text-lg sm:text-lg' }"
            />
            <UBadge
              v-if="historyData?.items.length"
              :label="String(historyData.items.length)"
              color="neutral"
              variant="subtle"
              size="sm"
            />
          </template>

          <USkeleton
            v-if="historyStatus === 'pending' && !historyData?.items.length"
            class="h-24 w-full rounded-xl"
          />

          <UPageList
            v-else-if="historyData?.items.length"
            class="gap-3"
          >
            <UCard
              v-for="item in historyData.items"
              :key="item.id"
              variant="subtle"
              :ui="{
                header: 'p-3.5 flex flex-wrap items-start justify-between gap-2',
                body: 'p-3.5 flex flex-col gap-2.5'
              }"
            >
              <template #header>
                <UPageList class="flex-row flex-wrap items-center gap-1.5 min-w-0">
                  <UBadge
                    :label="kindMeta(item.kind).label"
                    :icon="kindMeta(item.kind).icon"
                    :color="kindMeta(item.kind).color"
                    variant="subtle"
                    size="xs"
                  />
                  <UBadge
                    :label="statusMeta(item.status).label"
                    :icon="statusMeta(item.status).icon"
                    :color="statusMeta(item.status).color"
                    variant="soft"
                    size="xs"
                  />
                </UPageList>
                <UBadge
                  :label="formatDate(item.createdAt)"
                  color="neutral"
                  variant="outline"
                  size="xs"
                />
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

              <UAlert
                v-if="item.adminNote"
                color="success"
                variant="soft"
                icon="i-lucide-message-square-reply"
                :title="t('support.adminReply')"
                :description="item.adminNote"
              />
            </UCard>
          </UPageList>

          <UEmpty
            v-else
            icon="i-lucide-inbox"
            :title="t('support.historyEmpty')"
            variant="naked"
          />
        </UCard>
      </template>
    </UContainer>
  </AppPage>
</template>
