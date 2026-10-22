<script setup lang="ts">
/**
 * The catalogue of learning centres: those that chose to be listed and whose licence runs, with
 * their city, a few lines about them and their contacts. Open to everyone and indexed; a centre
 * that wants to be here applies at /centres/apply.
 */
definePageMeta({ guestLayout: true })
const { t } = useI18n()
useSeoMeta({ title: () => t('centres.title'), description: () => t('centres.lead') })

interface Centre {
  id: string
  name: string
  students: number
  city: string | null
  address: string | null
  description: string | null
  phone: string | null
  telegram: string | null
  website: string | null
  logoUrl: string | null
}

const { data: centres } = await useFetch<Centre[]>('/api/centres', { default: () => [] })

const search = ref('')
const city = ref('ALL')
const cities = computed(() => [...new Set(centres.value.map(c => c.city).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)))
const cityItems = computed(() => [{ label: t('centres.allCities'), value: 'ALL' }, ...cities.value.map(c => ({ label: c, value: c }))])
const shown = computed(() => {
  const q = search.value.trim().toLowerCase()
  return centres.value.filter(c => (city.value === 'ALL' || c.city === city.value)
    && (!q || c.name.toLowerCase().includes(q) || (c.city ?? '').toLowerCase().includes(q)))
})

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
const telLink = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}
</script>

<template>
  <AppPage
    :title="t('nav.centres')"
    icon="i-lucide-building-2"
  >
    <div class="flex flex-col gap-6 w-full">
      <div class="flex flex-col gap-2">
        <h1 class="text-2xl sm:text-3xl font-bold text-highlighted">
          <i18n-t
            keypath="centres.heading"
            scope="global"
          >
            <template #accent>
              <span class="text-accent">{{ t('centres.titleAccent') }}</span>
            </template>
          </i18n-t>
        </h1>
        <p class="text-muted max-w-2xl">
          {{ t('centres.lead') }}
        </p>
      </div>

      <div
        v-if="centres.length"
        class="flex flex-col sm:flex-row gap-2"
      >
        <UInput
          v-model="search"
          icon="i-lucide-search"
          :placeholder="t('centres.search')"
          class="w-full sm:w-80"
        />
        <USelect
          v-if="cities.length > 1"
          v-model="city"
          :items="cityItems"
          class="w-full sm:w-48"
        />
      </div>

      <div
        v-if="shown.length"
        class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <article
          v-for="c in shown"
          :key="c.id"
          class="flex flex-col gap-4 rounded-2xl bg-default ring ring-default p-5"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="c.logoUrl"
              :src="c.logoUrl"
              :alt="c.name"
              class="size-12 shrink-0 rounded-xl object-cover ring ring-default"
            >
            <div
              v-else
              class="size-12 shrink-0 rounded-xl bg-primary/10 text-primary font-bold grid place-items-center"
            >
              {{ initials(c.name) }}
            </div>
            <div class="min-w-0">
              <h2 class="font-semibold text-highlighted truncate">
                {{ c.name }}
              </h2>
              <p class="text-xs text-muted truncate">
                {{ [c.city, c.students ? t('centres.students', { n: c.students }, c.students) : null].filter(Boolean).join(' · ') }}
              </p>
            </div>
          </div>

          <p
            v-if="c.description"
            class="text-sm text-toned line-clamp-4 whitespace-pre-line"
          >
            {{ c.description }}
          </p>
          <p
            v-if="c.address"
            class="text-xs text-muted flex items-start gap-1.5"
          >
            <UIcon
              name="i-lucide-map-pin"
              class="size-3.5 shrink-0 mt-px"
            />
            {{ c.address }}
          </p>

          <div class="mt-auto flex flex-wrap gap-2">
            <UButton
              v-if="c.telegram"
              :to="`https://t.me/${c.telegram}`"
              target="_blank"
              icon="i-simple-icons-telegram"
              :label="t('centres.telegram')"
              size="sm"
            />
            <UButton
              v-if="c.phone"
              :to="telLink(c.phone)"
              icon="i-lucide-phone"
              :label="c.phone"
              size="sm"
              color="neutral"
              variant="outline"
            />
            <UButton
              v-if="c.website"
              :to="c.website"
              target="_blank"
              icon="i-lucide-globe"
              :label="host(c.website)"
              size="sm"
              color="neutral"
              variant="ghost"
            />
          </div>
        </article>
      </div>
      <UEmpty
        v-else
        icon="i-lucide-building-2"
        :title="centres.length ? t('centres.noMatch') : t('centres.empty')"
        :description="centres.length ? undefined : t('centres.emptyText')"
      />

      <!-- For a centre that wants to be here -->
      <div class="rounded-2xl p-6 sm:p-8 bg-linear-to-br from-primary-500 to-primary-700 text-white flex flex-col sm:flex-row sm:items-center gap-5">
        <div class="size-14 shrink-0 rounded-2xl bg-white/15 grid place-items-center">
          <UIcon
            name="i-lucide-school"
            class="size-7"
          />
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-xl font-bold">
            {{ t('centres.ctaTitle') }}
          </h2>
          <p class="text-white/80 text-sm mt-1">
            {{ t('centres.ctaText') }}
          </p>
        </div>
        <UButton
          to="/centres/apply"
          :label="t('centres.apply')"
          trailing-icon="i-lucide-arrow-right"
          size="lg"
          color="neutral"
          class="bg-white text-primary-700 hover:bg-white/90 shrink-0 justify-center"
        />
      </div>
    </div>
  </AppPage>
</template>
