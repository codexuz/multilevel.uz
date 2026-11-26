<script setup lang="ts">
import type { TilmochLang, VocabLookupEntry } from '~/composables/useVocabWidget'

const { t } = useI18n()
const toast = useToast()
const { loggedIn } = useMe()
const {
  sourceLang,
  targetLang,
  history,
  visible,
  setEnabled,
  setLangPair,
  swapLangs,
  pushHistory,
  clearHistory
} = useVocabWidget()

const open = ref(false)
const inputText = ref('')
const resultText = ref('')
const errorMsg = ref<string | null>(null)
const loading = ref(false)
const copied = ref(false)
const savingWord = ref(false)
const savedWordDone = ref(false)

const langItems = computed(() => [
  { label: t('vocabWidget.langEn'), value: 'eng_Latn' as TilmochLang },
  { label: t('vocabWidget.langUz'), value: 'uzn_Latn' as TilmochLang },
  { label: t('vocabWidget.langRu'), value: 'rus_Cyrl' as TilmochLang }
])

const sourceModel = computed<TilmochLang>({
  get: () => sourceLang.value,
  set: (val) => {
    if (val === targetLang.value) setLangPair(val, sourceLang.value)
    else setLangPair(val, targetLang.value)
  }
})

const targetModel = computed<TilmochLang>({
  get: () => targetLang.value,
  set: (val) => {
    if (val === sourceLang.value) setLangPair(targetLang.value, val)
    else setLangPair(sourceLang.value, val)
  }
})

// Close popover automatically if navigating onto an exam page.
watch(visible, (v) => {
  if (!v) open.value = false
})

// If the user highlighted text on the page and opens the widget, prefill it cleanly.
watch(open, (isOpen) => {
  if (!isOpen || !import.meta.client) return
  const sel = window.getSelection()?.toString().trim() ?? ''
  if (sel && sel.length <= 200 && sel !== inputText.value) {
    inputText.value = sel
    resultText.value = ''
    errorMsg.value = null
    savedWordDone.value = false
  }
})

const englishCandidate = computed(() => {
  const src = inputText.value.trim()
  const tgt = resultText.value.trim()
  const raw = sourceLang.value === 'eng_Latn' ? src : targetLang.value === 'eng_Latn' ? tgt : ''
  if (!raw || raw.length > 60 || raw.split(/\s+/).length > 4) return ''
  return raw
})

async function translate() {
  const text = inputText.value.trim()
  if (!text || loading.value) return
  loading.value = true
  errorMsg.value = null
  savedWordDone.value = false
  copied.value = false
  try {
    const res = await $fetch<{ translations: string[] }>('/api/translate', {
      method: 'POST',
      body: {
        texts: [text],
        source_lang: sourceLang.value,
        target_lang: targetLang.value
      }
    })
    const translated = (res.translations?.[0] ?? '').trim()
    resultText.value = translated
    if (translated) {
      pushHistory({
        text,
        translated,
        sourceLang: sourceLang.value,
        targetLang: targetLang.value
      })
    }
  } catch (e) {
    errorMsg.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    translate()
  }
}

async function copyResult() {
  if (!resultText.value || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(resultText.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {}
}

function speakEnglish() {
  if (!import.meta.client || !('speechSynthesis' in window)) return
  const phrase = sourceLang.value === 'eng_Latn' ? inputText.value.trim() : targetLang.value === 'eng_Latn' ? resultText.value.trim() : ''
  if (!phrase) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(phrase)
  u.lang = 'en-GB'
  window.speechSynthesis.speak(u)
}

async function saveToMyWords() {
  const word = englishCandidate.value
  if (!word || !loggedIn.value || savingWord.value) return
  savingWord.value = true
  try {
    const res = await $fetch<{ created: boolean }>('/api/me/words', {
      method: 'POST',
      body: { word }
    })
    savedWordDone.value = true
    toast.add({
      title: res.created ? t('vocabWidget.savedWord') : t('vocabWidget.alreadySaved'),
      description: word,
      color: 'success'
    })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    savingWord.value = false
  }
}

function loadEntry(entry: VocabLookupEntry) {
  setLangPair(entry.sourceLang, entry.targetLang)
  inputText.value = entry.text
  resultText.value = entry.translated
  errorMsg.value = null
  savedWordDone.value = false
}

function hideWidget() {
  open.value = false
  setEnabled(false)
  toast.add({
    title: t('vocabWidget.hiddenToast'),
    description: t('vocabWidget.hiddenHint'),
    color: 'neutral'
  })
}
</script>

<template>
  <UPopover
    v-if="visible"
    v-model:open="open"
    :content="{ side: 'top', align: 'end', sideOffset: 10 }"
    :ui="{ content: 'p-0 bg-transparent shadow-none ring-0' }"
  >
    <UButton
      icon="i-lucide-languages"
      :label="t('vocabWidget.openLabel')"
      color="primary"
      size="lg"
      class="fixed bottom-5 right-5 max-lg:bottom-20 z-40 rounded-full shadow-overlay"
      data-testid="vocab-widget-trigger"
    />

    <template #content>
      <UCard
        class="w-[min(92vw,24rem)] shadow-overlay"
        :ui="{
          header: 'flex items-center justify-between gap-2 px-4 py-3',
          body: 'p-4 flex flex-col gap-3',
          footer: 'px-4 py-2.5 flex items-center justify-between gap-2'
        }"
      >
        <template #header>
          <UUser
            :name="t('vocabWidget.title')"
            :description="t('vocabWidget.subtitle')"
            :avatar="{ icon: 'i-lucide-languages', ui: { root: 'bg-primary/10', icon: 'text-primary' } }"
            size="sm"
          />
          <UPageList class="flex-row items-center gap-1">
            <UButton
              to="/settings"
              icon="i-lucide-settings"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('nav.settings')"
              @click="open = false"
            />
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              square
              :aria-label="t('common.close')"
              @click="open = false"
            />
          </UPageList>
        </template>

        <!-- Language Pair Bar -->
        <UPageList class="flex-row items-center gap-2">
          <USelect
            v-model="sourceModel"
            :items="langItems"
            value-key="value"
            size="sm"
            class="flex-1"
          />
          <UButton
            icon="i-lucide-arrow-left-right"
            color="neutral"
            variant="ghost"
            size="sm"
            square
            :aria-label="t('vocabWidget.swap')"
            @click="swapLangs"
          />
          <USelect
            v-model="targetModel"
            :items="langItems"
            value-key="value"
            size="sm"
            class="flex-1"
          />
        </UPageList>

        <!-- Input & Translate Action -->
        <UTextarea
          v-model="inputText"
          :rows="2"
          :placeholder="t('vocabWidget.placeholder')"
          autofocus
          class="w-full"
          @keydown="onKeydown"
        />

        <UPageList class="flex-row items-center justify-between gap-2">
          <UBadge
            :label="t('vocabWidget.hintShortcut')"
            color="neutral"
            variant="subtle"
            size="xs"
          />
          <UButton
            :label="t('vocabWidget.translate')"
            icon="i-lucide-sparkles"
            size="sm"
            :loading="loading"
            :disabled="!inputText.trim()"
            @click="translate"
          />
        </UPageList>

        <!-- Error Alert -->
        <UAlert
          v-if="errorMsg"
          color="error"
          variant="subtle"
          icon="i-lucide-alert-circle"
          :title="t('vocabWidget.errorTitle')"
          :description="errorMsg"
        />

        <!-- Translation Result -->
        <UCard
          v-if="resultText"
          variant="subtle"
          :ui="{ body: 'p-3 flex flex-col gap-2.5' }"
        >
          <UPageHeader
            :description="resultText"
            :ui="{ root: 'border-0 py-0', description: 'text-sm sm:text-base font-semibold text-highlighted whitespace-pre-line mt-0' }"
          />
          <UPageList class="flex-row flex-wrap items-center gap-1.5">
            <UButton
              :label="copied ? t('vocabWidget.copied') : t('vocabWidget.copy')"
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :color="copied ? 'success' : 'neutral'"
              variant="outline"
              size="xs"
              @click="copyResult"
            />
            <UButton
              v-if="sourceLang === 'eng_Latn' || targetLang === 'eng_Latn'"
              :label="t('vocabWidget.listen')"
              icon="i-lucide-volume-2"
              color="neutral"
              variant="outline"
              size="xs"
              @click="speakEnglish"
            />
            <UButton
              v-if="loggedIn && englishCandidate"
              :label="savedWordDone ? t('vocabWidget.savedWord') : t('vocabWidget.saveWord')"
              :icon="savedWordDone ? 'i-lucide-bookmark-check' : 'i-lucide-bookmark-plus'"
              :color="savedWordDone ? 'success' : 'primary'"
              variant="soft"
              size="xs"
              :loading="savingWord"
              :disabled="savedWordDone"
              @click="saveToMyWords"
            />
          </UPageList>
        </UCard>

        <!-- Recent Lookups -->
        <template v-if="history.length">
          <USeparator />
          <UPageList class="gap-1.5">
            <UPageList class="flex-row items-center justify-between gap-2">
              <UBadge
                :label="t('vocabWidget.recent')"
                icon="i-lucide-history"
                color="neutral"
                variant="subtle"
                size="xs"
              />
              <UButton
                :label="t('vocabWidget.clearHistory')"
                color="neutral"
                variant="ghost"
                size="xs"
                @click="clearHistory"
              />
            </UPageList>
            <UPageList class="gap-1 max-h-36 overflow-y-auto">
              <UButton
                v-for="(item, idx) in history"
                :key="`${item.text}-${idx}`"
                :label="`${item.text} → ${item.translated}`"
                color="neutral"
                variant="ghost"
                size="xs"
                block
                :ui="{ base: 'justify-start', label: 'truncate' }"
                @click="loadEntry(item)"
              />
            </UPageList>
          </UPageList>
        </template>

        <template #footer>
          <UButton
            v-if="loggedIn"
            to="/words"
            :label="t('vocabWidget.myWords')"
            icon="i-lucide-book-marked"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="open = false"
          />
          <UButton
            :label="t('vocabWidget.hide')"
            icon="i-lucide-eye-off"
            color="neutral"
            variant="ghost"
            size="xs"
            class="ms-auto"
            @click="hideWidget"
          />
        </template>
      </UCard>
    </template>
  </UPopover>
</template>
