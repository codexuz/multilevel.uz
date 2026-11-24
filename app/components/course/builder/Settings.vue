<script setup lang="ts">
/**
 * The course builder's settings: when lessons open (all at once, between dates, or one after
 * another as each is done), the pass mark for quizzes, and deleting the course.
 */
const props = defineProps<{
  course: { id: string, title: string, dripMode: DripMode, dripStartAt: string | null, dripEndAt: string | null, passingScore: number }
}>()
const emit = defineEmits<{ saved: [], deleted: [] }>()
const { t } = useI18n()
const toast = useToast()
const { confirm } = useDialogs()

const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const form = reactive({
  dripMode: props.course.dripMode ?? 'ALWAYS_OPEN',
  dripStartAt: toLocalInput(props.course.dripStartAt),
  dripEndAt: toLocalInput(props.course.dripEndAt),
  passingScore: props.course.passingScore ?? 70
})
const dripItems = computed(() => DRIP_MODES.map(m => ({ label: t(`builder.drip.${m}`), description: t(`builder.drip.${m}Text`), value: m })))

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch(`/api/courses/${props.course.id}`, {
      method: 'PATCH',
      body: {
        dripMode: form.dripMode,
        dripStartAt: form.dripMode === 'DATE_RANGE' && form.dripStartAt ? new Date(form.dripStartAt).toISOString() : null,
        dripEndAt: form.dripMode === 'DATE_RANGE' && form.dripEndAt ? new Date(form.dripEndAt).toISOString() : null,
        passingScore: form.passingScore
      }
    })
    toast.add({ title: t('courses.saved'), color: 'success' })
    emit('saved')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!await confirm({ title: t('courses.deleteSure', { title: props.course.title }), confirmLabel: t('courses.delete'), color: 'error' })) return
  try {
    await $fetch(`/api/courses/${props.course.id}`, { method: 'DELETE' })
    emit('deleted')
  } catch (e) {
    toast.add({ title: t('common.notSaved'), description: errorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl">
    <form
      class="flex flex-col gap-6"
      @submit.prevent="save"
    >
      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            {{ t('builder.release') }}
          </h2>
          <p class="text-sm text-muted mt-0.5">
            {{ t('builder.releaseText') }}
          </p>
        </template>
        <div class="flex flex-col gap-4">
          <URadioGroup
            v-model="form.dripMode"
            :items="dripItems"
            variant="card"
          />
          <div
            v-if="form.dripMode === 'DATE_RANGE'"
            class="grid sm:grid-cols-2 gap-3"
          >
            <UFormField
              :label="t('builder.opensFrom')"
              :help="t('online.yourTime')"
            >
              <UInput
                v-model="form.dripStartAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="t('builder.closesOn')">
              <UInput
                v-model="form.dripEndAt"
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold text-highlighted">
            {{ t('builder.quizzes') }}
          </h2>
        </template>
        <UFormField
          :label="t('builder.passMark')"
          :help="t('builder.passMarkHelp')"
        >
          <UInputNumber
            v-model="form.passingScore"
            :min="0"
            :max="100"
            :format-options="{ style: 'unit', unit: 'percent' }"
            class="w-40"
          />
        </UFormField>
      </UCard>

      <div class="flex justify-end">
        <UButton
          type="submit"
          :label="t('common.save')"
          :loading="saving"
        />
      </div>
    </form>

    <UCard>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex-1 min-w-56">
          <p class="font-semibold text-highlighted">
            {{ t('courses.delete') }}
          </p>
          <p class="text-sm text-muted">
            {{ t('builder.deleteText') }}
          </p>
        </div>
        <UButton
          :label="t('courses.delete')"
          icon="i-lucide-trash-2"
          color="error"
          variant="outline"
          @click="remove"
        />
      </div>
    </UCard>
  </div>
</template>
