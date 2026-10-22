<script setup lang="ts">
/**
 * A learning centre asks to join: what it gets, and a short form. Signing in comes first, since that
 * account becomes the centre's owner; signing in brings the reader back with the form open. A
 * request already sent shows where it stands.
 */
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

interface MyRequest { id: string, name: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', centreId: string | null, createdAt: string }

const { loggedIn, refresh: refreshMe } = useMe()
const toast = useToast()
const mine = ref<MyRequest | null>(null)
const loaded = ref(false)
const fresh = ref(false)
watch(open, async (isOpen) => {
  if (!isOpen || !loggedIn.value) return
  mine.value = await $fetch<MyRequest | null>('/api/centres/requests/mine').catch(() => null)
  loaded.value = true
}, { immediate: true })
const showForm = computed(() => loggedIn.value && loaded.value && (!mine.value || (mine.value.status === 'REJECTED' && fresh.value)))

const form = reactive({ name: '', city: '', phone: '', telegram: '', students: undefined as number | undefined, message: '' })
const sending = ref(false)
async function send() {
  sending.value = true
  try {
    await $fetch('/api/centres/requests', { method: 'POST', body: form })
    toast.add({ title: t('centres.sent'), description: t('centres.sentText'), color: 'success' })
    fresh.value = false
    mine.value = await $fetch<MyRequest | null>('/api/centres/requests/mine').catch(() => null)
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    sending.value = false
  }
}
async function openCentre() {
  await refreshMe()
  open.value = false
  await navigateTo('/centre')
}

const benefits = [
  { icon: 'i-lucide-sparkles', title: 'centres.b1', text: 'centres.b1Text' },
  { icon: 'i-lucide-users', title: 'centres.b2', text: 'centres.b2Text' },
  { icon: 'i-lucide-clipboard-check', title: 'centres.b3', text: 'centres.b3Text' },
  { icon: 'i-lucide-building-2', title: 'centres.b4', text: 'centres.b4Text' }
]
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('centres.applyTitle')"
    :description="t('centres.applyLead')"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-6 min-w-0">
        <div class="grid sm:grid-cols-2 gap-3">
          <div
            v-for="b in benefits"
            :key="b.title"
            class="flex gap-3 rounded-xl bg-elevated/50 p-3"
          >
            <div class="size-8 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <UIcon
                :name="b.icon"
                class="size-4"
              />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-highlighted">
                {{ t(b.title) }}
              </p>
              <p class="text-xs text-muted mt-0.5">
                {{ t(b.text) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Not signed in: the account that signs in becomes the owner -->
        <div
          v-if="!loggedIn"
          class="flex flex-col items-center text-center gap-3 rounded-xl bg-primary/5 p-5"
        >
          <p class="font-semibold text-highlighted">
            {{ t('centres.signIn') }}
          </p>
          <p class="text-sm text-muted max-w-md">
            {{ t('centres.signInText') }}
          </p>
          <UButton
            :to="`/login?next=${encodeURIComponent('/centres?apply=1')}`"
            icon="i-lucide-log-in"
            :label="t('nav.signIn')"
            size="lg"
          />
        </div>

        <div
          v-else-if="!loaded"
          class="grid place-items-center py-6"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-6 animate-spin text-muted"
          />
        </div>

        <!-- A request already sent -->
        <div
          v-else-if="mine && !showForm"
          class="flex flex-col items-center text-center gap-3 rounded-xl bg-elevated/50 p-5"
        >
          <div
            class="size-12 rounded-full grid place-items-center"
            :class="mine.status === 'APPROVED' ? 'bg-success/15 text-success' : mine.status === 'REJECTED' ? 'bg-error/10 text-error' : 'bg-warning/15 text-warning'"
          >
            <UIcon
              :name="mine.status === 'APPROVED' ? 'i-lucide-check' : mine.status === 'REJECTED' ? 'i-lucide-x' : 'i-lucide-hourglass'"
              class="size-6"
            />
          </div>
          <template v-if="mine.status === 'PENDING'">
            <p class="font-semibold text-highlighted">
              {{ t('centres.pending') }}
            </p>
            <p class="text-sm text-muted">
              {{ t('centres.pendingText', { name: mine.name, date: formatDate(mine.createdAt) }) }}
            </p>
          </template>
          <template v-else-if="mine.status === 'APPROVED'">
            <p class="font-semibold text-highlighted">
              {{ t('centres.approved', { name: mine.name }) }}
            </p>
            <p class="text-sm text-muted">
              {{ t('centres.approvedText') }}
            </p>
            <UButton
              :label="t('centres.openCentre')"
              size="lg"
              @click="openCentre"
            />
          </template>
          <template v-else>
            <p class="font-semibold text-highlighted">
              {{ t('centres.rejected', { name: mine.name }) }}
            </p>
            <p class="text-sm text-muted">
              {{ t('centres.rejectedText') }}
            </p>
            <UButton
              :label="t('centres.newRequest')"
              size="lg"
              @click="fresh = true"
            />
          </template>
        </div>

        <!-- The form -->
        <form
          v-else
          class="grid sm:grid-cols-2 gap-4 [&>*]:min-w-0"
          @submit.prevent="send"
        >
          <UFormField
            :label="t('centres.name')"
            required
            class="sm:col-span-2"
          >
            <UInput
              v-model="form.name"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField :label="t('centres.city')">
            <UInput
              v-model="form.city"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('centres.studentsField')">
            <UInput
              v-model.number="form.students"
              type="number"
              min="1"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('centres.phone')"
            required
          >
            <UInput
              v-model="form.phone"
              type="tel"
              placeholder="+998 90 123 45 67"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            :label="t('centres.telegramField')"
            :hint="t('centres.optional')"
          >
            <UInput
              v-model="form.telegram"
              placeholder="@username"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('centres.message')"
            :hint="t('centres.optional')"
            class="sm:col-span-2"
          >
            <UTextarea
              v-model="form.message"
              :rows="3"
              autoresize
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            :label="t('centres.send')"
            :loading="sending"
            size="lg"
            block
            class="sm:col-span-2 justify-center"
          />
        </form>
      </div>
    </template>
  </UModal>
</template>
