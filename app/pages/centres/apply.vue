<script setup lang="ts">
/**
 * A learning centre asks to join: what it gets, how it goes, and a short form. Signing in comes
 * first, since that account becomes the centre's owner. A request already sent shows where it stands.
 */
definePageMeta({ guestLayout: true })
const { t } = useI18n()
useSeoMeta({ title: () => t('centres.applyTitle'), description: () => t('centres.applyLead') })

interface MyRequest { id: string, name: string, status: 'PENDING' | 'APPROVED' | 'REJECTED', centreId: string | null, createdAt: string }

const { loggedIn, refresh: refreshMe } = useMe()
const route = useRoute()
const toast = useToast()
const { data: mine, refresh } = await useFetch<MyRequest | null>('/api/centres/requests/mine', { immediate: loggedIn.value, default: () => null })
const fresh = ref(false)
const showForm = computed(() => loggedIn.value && (!mine.value || (mine.value.status === 'REJECTED' && fresh.value)))

const form = reactive({ name: '', city: '', phone: '', telegram: '', students: undefined as number | undefined, message: '' })
const sending = ref(false)
async function send() {
  sending.value = true
  try {
    await $fetch('/api/centres/requests', { method: 'POST', body: form })
    toast.add({ title: t('centres.sent'), description: t('centres.sentText'), color: 'success' })
    fresh.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    sending.value = false
  }
}
async function openCentre() {
  await refreshMe()
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
  <AppPage
    :title="t('centres.applyTitle')"
    back="/centres"
  >
    <div class="w-full max-w-3xl flex flex-col gap-8">
      <div class="flex flex-col items-center text-center gap-3">
        <div class="size-16 rounded-2xl bg-linear-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-500/25 grid place-items-center">
          <UIcon
            name="i-lucide-school"
            class="size-8 text-white"
          />
        </div>
        <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-highlighted text-balance">
          {{ t('centres.applyTitle') }}
        </h1>
        <p class="text-muted text-balance max-w-xl">
          {{ t('centres.applyLead') }}
        </p>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div
          v-for="b in benefits"
          :key="b.title"
          class="flex gap-3 rounded-xl bg-default ring ring-default p-4"
        >
          <div class="size-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <UIcon
              :name="b.icon"
              class="size-5"
            />
          </div>
          <div>
            <p class="font-semibold text-highlighted">
              {{ t(b.title) }}
            </p>
            <p class="text-sm text-muted mt-0.5">
              {{ t(b.text) }}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 class="font-semibold text-highlighted mb-3">
          {{ t('centres.how') }}
        </h2>
        <ol class="grid sm:grid-cols-3 gap-3">
          <li
            v-for="(s, i) in ['centres.s1', 'centres.s2', 'centres.s3']"
            :key="s"
            class="flex items-start gap-3 text-sm"
          >
            <span class="size-7 shrink-0 rounded-full bg-primary text-inverted font-bold grid place-items-center">{{ i + 1 }}</span>
            <span class="text-toned pt-1">{{ t(s) }}</span>
          </li>
        </ol>
      </div>

      <div class="rounded-2xl border border-primary/15 bg-linear-to-br from-primary/3 to-primary/8 p-6 sm:p-8">
        <!-- Not signed in: the account that signs in becomes the owner -->
        <div
          v-if="!loggedIn"
          class="flex flex-col items-center text-center gap-3"
        >
          <p class="text-lg font-semibold text-highlighted">
            {{ t('centres.signIn') }}
          </p>
          <p class="text-sm text-muted max-w-md">
            {{ t('centres.signInText') }}
          </p>
          <UButton
            :to="`/login?next=${encodeURIComponent(route.fullPath)}`"
            icon="i-lucide-log-in"
            :label="t('nav.signIn')"
            size="xl"
            class="mt-1"
          />
        </div>

        <!-- A request already sent -->
        <div
          v-else-if="mine && !showForm"
          class="flex flex-col items-center text-center gap-3"
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
            <p class="text-lg font-semibold text-highlighted">
              {{ t('centres.pending') }}
            </p>
            <p class="text-muted">
              {{ t('centres.pendingText', { name: mine.name, date: formatDate(mine.createdAt) }) }}
            </p>
          </template>
          <template v-else-if="mine.status === 'APPROVED'">
            <p class="text-lg font-semibold text-highlighted">
              {{ t('centres.approved', { name: mine.name }) }}
            </p>
            <p class="text-muted">
              {{ t('centres.approvedText') }}
            </p>
            <UButton
              :label="t('centres.openCentre')"
              size="xl"
              class="mt-1"
              @click="openCentre"
            />
          </template>
          <template v-else>
            <p class="text-lg font-semibold text-highlighted">
              {{ t('centres.rejected', { name: mine.name }) }}
            </p>
            <p class="text-muted">
              {{ t('centres.rejectedText') }}
            </p>
            <UButton
              :label="t('centres.newRequest')"
              size="xl"
              class="mt-1"
              @click="fresh = true"
            />
          </template>
        </div>

        <!-- The form -->
        <form
          v-else
          class="grid sm:grid-cols-2 gap-4"
          @submit.prevent="send"
        >
          <h2 class="sm:col-span-2 font-semibold text-highlighted">
            {{ t('centres.formTitle') }}
          </h2>
          <UFormField
            :label="t('centres.name')"
            required
            class="sm:col-span-2"
          >
            <UInput
              v-model="form.name"
              size="lg"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            :label="t('centres.city')"
          >
            <UInput
              v-model="form.city"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="t('centres.studentsField')"
          >
            <UInput
              v-model.number="form.students"
              type="number"
              min="1"
              size="lg"
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
              size="lg"
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
              size="lg"
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
            size="xl"
            block
            class="sm:col-span-2 h-12 justify-center"
          />
        </form>
      </div>
    </div>
  </AppPage>
</template>
