<script setup lang="ts">
/** A learning centre in the catalogue: its logo, name and city, a few lines about it, and its contacts. */
export interface PublicCentre {
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
defineProps<{ centre: PublicCentre }>()
const { t } = useI18n()

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
  <article class="flex flex-col gap-4 rounded-2xl bg-default ring ring-default p-5 h-full">
    <div class="flex items-center gap-3">
      <img
        v-if="centre.logoUrl"
        :src="centre.logoUrl"
        :alt="centre.name"
        class="size-12 shrink-0 rounded-xl object-cover ring ring-default"
      >
      <div
        v-else
        class="size-12 shrink-0 rounded-xl bg-primary/10 text-primary font-bold grid place-items-center"
      >
        {{ initials(centre.name) }}
      </div>
      <div class="min-w-0">
        <h3 class="font-semibold text-highlighted truncate">
          {{ centre.name }}
        </h3>
        <p class="text-xs text-muted truncate">
          {{ [centre.city, centre.students ? t('centres.students', { n: centre.students }, centre.students) : null].filter(Boolean).join(' · ') }}
        </p>
      </div>
    </div>

    <p
      v-if="centre.description"
      class="text-sm text-toned line-clamp-3 whitespace-pre-line"
    >
      {{ centre.description }}
    </p>
    <p
      v-if="centre.address"
      class="text-xs text-muted flex items-start gap-1.5"
    >
      <UIcon
        name="i-lucide-map-pin"
        class="size-3.5 shrink-0 mt-px"
      />
      {{ centre.address }}
    </p>

    <div class="mt-auto flex flex-wrap gap-2">
      <UButton
        v-if="centre.telegram"
        :to="`https://t.me/${centre.telegram}`"
        target="_blank"
        icon="i-simple-icons-telegram"
        :label="t('centres.telegram')"
        size="sm"
      />
      <UButton
        v-if="centre.phone"
        :to="telLink(centre.phone)"
        icon="i-lucide-phone"
        :label="centre.phone"
        size="sm"
        color="neutral"
        variant="outline"
      />
      <UButton
        v-if="centre.website"
        :to="centre.website"
        target="_blank"
        icon="i-lucide-globe"
        :label="host(centre.website)"
        size="sm"
        color="neutral"
        variant="ghost"
      />
    </div>
  </article>
</template>
