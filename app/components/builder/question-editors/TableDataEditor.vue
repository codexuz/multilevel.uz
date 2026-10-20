<script setup lang="ts">
const headers = defineModel<string[]>('headers', { required: true })
const rows = defineModel<string[][]>('rows', { required: true })

function addColumn() {
  headers.value = [...headers.value, '']
  rows.value = rows.value.map(r => [...r, ''])
}

function removeColumn(ci: number) {
  headers.value = headers.value.filter((_, i) => i !== ci)
  rows.value = rows.value.map(r => r.filter((_, i) => i !== ci))
}

function addRow() {
  rows.value = [...rows.value, Array.from({ length: headers.value.length }, () => '')]
}
</script>

<template>
  <UCard
    variant="subtle"
    :ui="{ header: 'py-2.5 sm:px-4', body: 'sm:p-4 space-y-2 overflow-x-auto' }"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-sm font-medium">
            Table data
          </p>
          <p class="text-xs text-muted">
            Use ____ in cells for blanks (linked to sub-questions by order).
          </p>
        </div>
        <div class="flex gap-1">
          <UButton
            icon="i-lucide-plus"
            label="Column"
            size="xs"
            variant="soft"
            @click="addColumn"
          />
          <UButton
            icon="i-lucide-plus"
            label="Row"
            size="xs"
            variant="soft"
            @click="addRow"
          />
        </div>
      </div>
    </template>

    <div
      class="grid gap-1 min-w-max"
      :style="{ gridTemplateColumns: `repeat(${headers.length}, minmax(9rem, 1fr)) 2rem` }"
    >
      <template
        v-for="(_, ci) in headers"
        :key="`h${ci}`"
      >
        <UInput
          v-model="headers[ci]"
          size="sm"
          :placeholder="`Header ${ci + 1}`"
          :ui="{ base: 'font-semibold', trailing: 'pe-1' }"
        >
          <template
            v-if="headers.length > 1"
            #trailing
          >
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="error"
              variant="link"
              aria-label="Remove column"
              @click="removeColumn(ci)"
            />
          </template>
        </UInput>
      </template>
      <span />
      <template
        v-for="(row, ri) in rows"
        :key="`r${ri}`"
      >
        <UInput
          v-for="(_, ci) in row"
          :key="`c${ri}-${ci}`"
          v-model="row[ci]"
          size="sm"
          placeholder="Cell value"
          :color="row[ci] === '____' ? 'warning' : 'neutral'"
          :highlight="row[ci] === '____'"
        />
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="error"
          variant="ghost"
          :disabled="rows.length <= 1"
          aria-label="Remove row"
          @click="() => { rows = rows.filter((_, i) => i !== ri) }"
        />
      </template>
    </div>
  </UCard>
</template>
