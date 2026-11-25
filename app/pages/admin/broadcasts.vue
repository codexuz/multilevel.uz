<script setup lang="ts">
import { uploadFile } from '~/services/http'

/**
 * Broadcasts: news and updates sent through the Telegram bot to everyone it may write to (or to
 * students, teachers, one exam's candidates or one language's readers), and to the channels if
 * picked. Written in Uzbek, Russian and English; each reader gets theirs, else the first written.
 * A test goes to the admin first; the list below shows each one's progress.
 */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Broadcasts', robots: 'noindex' })
const toast = useToast()
const { confirm } = useDialogs()

type Lang = 'uz' | 'ru' | 'en'
interface Broadcast { id: string, texts: Partial<Record<Lang, string>>, imageUrl: string | null, buttonText: string | null, buttonUrl: string | null, audience: { role: string, exam: string, locale: string }, channelIds: string[] | null, status: 'SENDING' | 'DONE', total: number, sent: number, failed: number, createdAt: string, finishedAt: string | null }
interface Channel { id: string, title: string, exam: string | null, locale: string }
const { data, refresh } = await useFetch<{ items: Broadcast[], channels: Channel[], botReady: boolean }>('/api/admin/broadcasts', { default: () => ({ items: [], channels: [], botReady: false }) })

const LANGS: { value: Lang, label: string }[] = [{ value: 'uz', label: 'O‘zbekcha' }, { value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }]
const form = reactive({ texts: { uz: '', ru: '', en: '' } as Record<Lang, string>, imageUrl: '', buttonText: '', buttonUrl: '', role: 'ALL', exam: 'ANY', locale: 'ANY', channelIds: [] as string[] })
const lang = ref<Lang>('uz')
const langTabs = computed(() => LANGS.map(l => ({ label: l.label, value: l.value, icon: form.texts[l.value].trim() ? 'i-lucide-circle-check' : undefined })))
const written = computed(() => LANGS.filter(l => form.texts[l.value].trim()).map(l => l.value))
const max = computed(() => (form.imageUrl ? 1000 : 3800))

// ---- who it reaches ----
const count = ref<number | null>(null)
let counting: ReturnType<typeof setTimeout> | undefined
watch(() => [form.role, form.exam, form.locale], () => {
  clearTimeout(counting)
  counting = setTimeout(async () => {
    count.value = (await $fetch<{ count: number }>('/api/admin/broadcasts/audience', { query: { role: form.role, exam: form.exam, locale: form.locale } }).catch(() => ({ count: null as any }))).count
  }, 200)
}, { immediate: true })

// ---- the picture ----
const uploading = ref(false)
async function onImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    form.imageUrl = (await uploadFile(file, { purpose: 'course-image' })).url
  } catch (err) {
    toast.add({ title: 'Not uploaded', description: errorMessage(err), color: 'error' })
  } finally {
    uploading.value = false
  }
}

// ---- preview: what Telegram shows (the server formats the same way) ----
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function formatted(text: string) {
  return esc(text.trim())
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])_(.+?)_(?=[\s).,!?]|$)/gm, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label: string, url: string) => `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" class="text-sky-600 underline">${label}</a>`)
}
const previewText = computed(() => form.texts[lang.value].trim() || form.texts.uz.trim() || form.texts.ru.trim() || form.texts.en.trim())

const body = () => ({
  texts: Object.fromEntries(written.value.map(l => [l, form.texts[l]])),
  imageUrl: form.imageUrl || null,
  buttonText: form.buttonText || null,
  buttonUrl: form.buttonUrl || null
})
const testing = ref(false)
async function sendTest() {
  testing.value = true
  try {
    await $fetch('/api/admin/broadcasts/test', { method: 'POST', body: body() })
    toast.add({ title: 'Test sent to your Telegram', color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    toast.add({ title: 'Test not sent', description: errorMessage(e), color: 'error' })
  } finally {
    testing.value = false
  }
}
const sending = ref(false)
async function send() {
  const n = count.value ?? 0
  const ok = await confirm({
    title: `Send to ${n} ${n === 1 ? 'person' : 'people'}?`,
    description: `${form.channelIds.length ? `It is also posted to ${form.channelIds.length} channel${form.channelIds.length === 1 ? '' : 's'}. ` : ''}It cannot be taken back once sent.`,
    confirmLabel: 'Send',
    color: 'primary'
  })
  if (!ok) return
  sending.value = true
  try {
    await $fetch('/api/admin/broadcasts', { method: 'POST', body: { ...body(), audience: { role: form.role, exam: form.exam, locale: form.locale }, channelIds: form.channelIds } })
    toast.add({ title: 'Sending…', description: 'Progress shows below.', color: 'success' })
    form.texts = { uz: '', ru: '', en: '' }
    form.imageUrl = ''
    form.buttonText = ''
    form.buttonUrl = ''
    form.channelIds = []
    await refresh()
  } catch (e) {
    toast.add({ title: 'Not sent', description: errorMessage(e), color: 'error' })
  } finally {
    sending.value = false
  }
}
const ready = computed(() => written.value.length > 0 && written.value.every(l => form.texts[l].length <= max.value) && (!form.buttonText || !!form.buttonUrl))

// ---- history: follow one being sent ----
let poll: ReturnType<typeof setInterval> | undefined
onMounted(() => (poll = setInterval(() => data.value.items.some(b => b.status === 'SENDING') && refresh(), 3000)))
onBeforeUnmount(() => clearInterval(poll))
const ROLE: Record<string, string> = { ALL: 'Everyone', STUDENTS: 'Students', TEACHERS: 'Teachers' }
const audienceText = (b: Broadcast) => [ROLE[b.audience.role] ?? 'Everyone', b.audience.exam !== 'ANY' ? examLabel(b.audience.exam as Exam) : null, b.audience.locale !== 'ANY' ? b.audience.locale.toUpperCase() : null].filter(Boolean).join(' · ')
const firstText = (b: Broadcast) => (b.texts.uz ?? b.texts.ru ?? b.texts.en ?? '').replace(/\*\*|__?/g, '')
const pct = (b: Broadcast) => (b.total ? Math.min(100, Math.round((b.sent + b.failed) / b.total * 100)) : 100)
</script>

<template>
  <AppPage
    title="Broadcasts"
    icon="i-lucide-megaphone"
  >
    <div class="flex flex-col gap-5">
      <UAlert
        v-if="!data.botReady"
        icon="i-lucide-bot-off"
        color="warning"
        variant="subtle"
        title="The Telegram bot is not set up"
        description="Set TELEGRAM_BOT_TOKEN on the server to send broadcasts."
      />

      <div class="grid lg:grid-cols-[1fr_22rem] gap-5 items-start">
        <UCard :ui="{ body: 'flex flex-col gap-4' }">
          <div>
            <UTabs
              v-model="lang"
              :items="langTabs"
              :content="false"
              size="sm"
              class="w-full sm:w-fit"
              data-testid="bc-lang"
            />
            <UTextarea
              v-model="form.texts[lang]"
              :rows="7"
              autoresize
              :maxrows="16"
              :placeholder="lang === 'uz' ? 'Yangiliklar va yangilanishlar…' : lang === 'ru' ? 'Новости и обновления…' : 'News and updates…'"
              class="w-full mt-2"
              data-testid="bc-text"
            />
            <div class="flex flex-wrap justify-between gap-2 text-xs mt-1">
              <span class="text-muted">**bold** · _italic_ · [link text](https://…) · Readers get their language, else the first one written.</span>
              <span :class="form.texts[lang].length > max ? 'text-error font-bold' : 'text-muted'">{{ form.texts[lang].length }} / {{ max }}</span>
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField
              label="Picture (optional)"
              help="Sent with the text as its caption (at most 1000 characters)."
            >
              <div class="flex items-center gap-2">
                <label class="cursor-pointer">
                  <UButton
                    as="span"
                    :label="form.imageUrl ? 'Change' : 'Upload'"
                    icon="i-lucide-image"
                    size="sm"
                    color="neutral"
                    variant="outline"
                    :loading="uploading"
                  />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    class="hidden"
                    @change="onImage"
                  >
                </label>
                <UButton
                  v-if="form.imageUrl"
                  icon="i-lucide-x"
                  size="sm"
                  color="error"
                  variant="ghost"
                  aria-label="Remove the picture"
                  @click="form.imageUrl = ''"
                />
              </div>
            </UFormField>
            <div class="grid grid-cols-2 gap-2">
              <UFormField label="Button text">
                <UInput
                  v-model="form.buttonText"
                  placeholder="Try it"
                  :maxlength="40"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Button link">
                <UInput
                  v-model="form.buttonUrl"
                  placeholder="/tests or https://…"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>

          <div class="rounded-lg bg-elevated/40 p-3 flex flex-col gap-3">
            <p class="text-sm font-bold text-highlighted">
              Who gets it
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <USelect
                v-model="form.role"
                :items="[{ label: 'Everyone', value: 'ALL' }, { label: 'Students', value: 'STUDENTS' }, { label: 'Teachers', value: 'TEACHERS' }]"
                data-testid="bc-role"
              />
              <USelect
                v-model="form.exam"
                :items="[{ label: 'Any exam', value: 'ANY' }, { label: 'IELTS', value: 'IELTS' }, { label: 'Multilevel', value: 'MULTILEVEL' }]"
                data-testid="bc-exam"
              />
              <USelect
                v-model="form.locale"
                :items="[{ label: 'Any language', value: 'ANY' }, ...LANGS.map(l => ({ label: l.label, value: l.value }))]"
              />
            </div>
            <p
              class="text-sm"
              data-testid="bc-count"
            >
              <UIcon
                name="i-lucide-users"
                class="size-4 align-[-3px] text-primary"
              />
              Reaches <strong class="tabular-nums">{{ count ?? '…' }}</strong> {{ count === 1 ? 'person' : 'people' }} on Telegram
              <span class="text-muted">(connected the bot, notifications on)</span>
            </p>
            <div
              v-if="data.channels.length"
              class="flex flex-col gap-1.5"
            >
              <p class="text-xs font-bold text-muted">
                Also post to channels
              </p>
              <UCheckbox
                v-for="c in data.channels"
                :key="c.id"
                :model-value="form.channelIds.includes(c.id)"
                :label="`${c.title}${c.exam ? ` · ${examLabel(c.exam as Exam)}` : ''} · ${c.locale.toUpperCase()}`"
                @update:model-value="v => (form.channelIds = v ? [...form.channelIds, c.id] : form.channelIds.filter(x => x !== c.id))"
              />
            </div>
          </div>

          <div class="flex flex-wrap justify-end gap-2">
            <UButton
              label="Send a test to me"
              icon="i-lucide-flask-conical"
              color="neutral"
              variant="outline"
              :loading="testing"
              :disabled="!ready || !data.botReady"
              data-testid="bc-test"
              @click="sendTest"
            />
            <UButton
              :label="`Send to ${count ?? '…'} ${count === 1 ? 'person' : 'people'}`"
              icon="i-simple-icons-telegram"
              :loading="sending"
              :disabled="!ready || !data.botReady || !count"
              data-testid="bc-send"
              @click="send"
            />
          </div>
        </UCard>

        <!-- Preview, as Telegram shows it -->
        <div class="lg:sticky lg:top-20 flex flex-col gap-2">
          <p class="text-xs font-bold text-muted uppercase tracking-wide">
            Preview ({{ LANGS.find(l => l.value === lang)?.label }})
          </p>
          <div class="rounded-2xl bg-[#c9dcb1] dark:bg-[#0e1621] p-4">
            <div class="max-w-[19rem] rounded-2xl rounded-bl-md bg-white dark:bg-[#182533] text-[#000] dark:text-white shadow-sm overflow-hidden">
              <img
                v-if="form.imageUrl"
                :src="form.imageUrl"
                alt=""
                class="w-full max-h-56 object-cover"
              >
              <!-- eslint-disable vue/no-v-html -- escaped above, then only <b>, <i> and <a> added -->
              <div
                class="px-3 py-2 text-[15px] leading-snug whitespace-pre-line break-words"
                data-testid="bc-preview"
                v-html="previewText ? formatted(previewText) : '<span class=&quot;opacity-50&quot;>Your message…</span>'"
              />
              <!-- eslint-enable vue/no-v-html -->
            </div>
            <div
              v-if="form.buttonText"
              class="max-w-[19rem] mt-1 rounded-lg bg-white/70 dark:bg-[#182533]/80 text-center text-sm font-semibold text-[#3a6d99] dark:text-sky-300 py-2"
            >
              {{ form.buttonText }}
            </div>
          </div>
        </div>
      </div>

      <!-- Sent -->
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-extrabold uppercase tracking-wide text-muted">
          Sent
        </h2>
        <UEmpty
          v-if="!data.items.length"
          icon="i-lucide-megaphone"
          title="No broadcasts yet"
          variant="naked"
        />
        <div
          v-else
          class="rounded-[var(--card-radius)] ring-2 ring-default divide-y divide-default overflow-hidden bg-default"
          data-testid="bc-history"
        >
          <div
            v-for="b in data.items"
            :key="b.id"
            class="p-3 sm:p-4 flex flex-col gap-2"
          >
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :label="b.status === 'SENDING' ? 'Sending…' : 'Sent'"
                :color="b.status === 'SENDING' ? 'warning' : 'success'"
                variant="subtle"
                size="sm"
              />
              <span class="text-xs text-muted">{{ audienceText(b) }} · written in {{ Object.keys(b.texts).map(l => l.toUpperCase()).join(', ') }}<template v-if="b.channelIds?.length"> · {{ b.channelIds.length }} channel{{ b.channelIds.length === 1 ? '' : 's' }}</template></span>
              <span class="ms-auto text-xs text-muted">{{ localeDate(b.createdAt, intlLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
            <p class="text-sm text-toned line-clamp-2">
              {{ firstText(b) }}
            </p>
            <div class="flex items-center gap-3">
              <div class="h-2 flex-1 rounded-full bg-accented/70 overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary transition-[width]"
                  :style="{ width: `${pct(b)}%` }"
                />
              </div>
              <span class="text-xs tabular-nums text-muted whitespace-nowrap">{{ b.sent }} sent<template v-if="b.failed"> · {{ b.failed }} failed</template> · {{ b.total }} in all</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </AppPage>
</template>
