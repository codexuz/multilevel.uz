<script setup lang="ts">
import { uploadFile } from '~/services/http'

/**
 * How a centre shows in the public catalogue (/centres), for its owner: whether it is listed, a
 * few lines about it, its contacts and a logo.
 */
interface Listing {
  city: string | null
  address: string | null
  description: string | null
  phone: string | null
  telegram: string | null
  website: string | null
  logoUrl: string | null
  listed: boolean
}
const props = defineProps<{ centreId: string, listing: Listing }>()

const { t } = useI18n()
const toast = useToast()
// Fields hold text ('' for none); the server keeps '' as nothing.
const asForm = (l: Listing) => ({
  city: l.city ?? '', address: l.address ?? '', description: l.description ?? '', phone: l.phone ?? '',
  telegram: l.telegram ? `@${l.telegram}` : '', website: l.website ?? '', logoUrl: l.logoUrl ?? '', listed: l.listed
})
const form = reactive(asForm(props.listing))
const saving = ref(false)
const uploading = ref(false)

async function save() {
  saving.value = true
  try {
    const saved = await $fetch<Listing>(`/api/centres/${props.centreId}/listing`, { method: 'PATCH', body: form })
    Object.assign(form, asForm(saved))
    toast.add({ title: t('centres.listingSaved'), color: 'success' })
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function pickLogo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    form.logoUrl = (await uploadFile(file, { purpose: 'centre-logo' })).url
  } catch (err) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(err), color: 'error' })
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div>
          <h2 class="font-semibold text-highlighted">
            {{ t('centres.listingTitle') }}
          </h2>
          <p class="text-xs text-muted">
            {{ t('centres.listingText') }}
          </p>
        </div>
        <UButton
          to="/centres"
          :label="t('centres.seeCatalogue')"
          trailing-icon="i-lucide-arrow-up-right"
          size="xs"
          color="neutral"
          variant="ghost"
        />
      </div>
    </template>
    <form
      class="grid sm:grid-cols-2 gap-4"
      @submit.prevent="save"
    >
      <USwitch
        v-model="form.listed"
        :label="t('centres.listed')"
        :description="t('centres.listedHint')"
        class="sm:col-span-2"
      />
      <div class="sm:col-span-2 flex items-center gap-3">
        <img
          v-if="form.logoUrl"
          :src="form.logoUrl"
          alt=""
          class="size-14 rounded-xl object-cover ring ring-default"
        >
        <div
          v-else
          class="size-14 rounded-xl bg-elevated grid place-items-center text-dimmed"
        >
          <UIcon
            name="i-lucide-image"
            class="size-6"
          />
        </div>
        <label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="sr-only"
            @change="pickLogo"
          >
          <UButton
            as="span"
            :label="t('centres.uploadLogo')"
            icon="i-lucide-upload"
            :loading="uploading"
            size="sm"
            color="neutral"
            variant="outline"
            class="cursor-pointer"
          />
        </label>
      </div>
      <UFormField
        :label="t('centres.about')"
        class="sm:col-span-2"
      >
        <UTextarea
          v-model="form.description"
          :placeholder="t('centres.aboutPlaceholder')"
          :rows="3"
          :maxlength="1000"
          autoresize
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('centres.city')">
        <UInput
          v-model="form.city"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('centres.address')">
        <UInput
          v-model="form.address"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('centres.phone')">
        <UInput
          v-model="form.phone"
          type="tel"
          placeholder="+998 90 123 45 67"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('centres.telegramField')">
        <UInput
          v-model="form.telegram"
          placeholder="@username"
          class="w-full"
        />
      </UFormField>
      <UFormField
        :label="t('centres.website')"
        class="sm:col-span-2"
      >
        <UInput
          v-model="form.website"
          placeholder="example.uz"
          class="w-full"
        />
      </UFormField>
      <div class="sm:col-span-2 flex justify-end">
        <UButton
          type="submit"
          :label="t('common.save')"
          :loading="saving"
        />
      </div>
    </form>
  </UCard>
</template>
