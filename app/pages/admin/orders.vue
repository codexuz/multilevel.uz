<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Order } from '~/utils/billing'

/** Every order, Click and private sales alike, and what came in this month. */
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Orders', robots: 'noindex' })

const page = ref(1)
const status = ref('ALL')
watch(status, () => (page.value = 1))
const { data, status: loadState } = await useFetch<{ items: Order[], total: number, pages: number, month: { revenueUzs: number, paid: number } }>('/api/admin/orders', {
  query: { page, limit: 20, status: computed(() => (status.value === 'ALL' ? undefined : status.value)) },
  lazy: true
})

const columns: TableColumn<Order>[] = [
  { id: 'number', header: '#', meta: { class: { th: 'max-sm:hidden', td: 'max-sm:hidden' } } },
  { id: 'user', header: 'Customer' },
  { id: 'plan', header: 'Plan', meta: { class: { th: 'max-md:hidden', td: 'max-md:hidden' } } },
  { id: 'amount', header: 'Amount' },
  { id: 'status', header: 'Status', meta: { class: { th: 'max-sm:hidden', td: 'max-sm:hidden' } } },
  { id: 'date', header: 'Date', meta: { class: { th: 'max-lg:hidden', td: 'max-lg:hidden' } } }
]
const statusItems = [{ label: 'Any status', value: 'ALL' }, { label: 'Paid', value: 'PAID' }, { label: 'Waiting', value: 'PENDING' }, { label: 'Cancelled', value: 'CANCELLED' }]
</script>

<template>
  <AppPage
    title="Orders"
    icon="i-lucide-receipt"
  >
    <template #toolbar>
      <UDashboardToolbar>
        <USelect
          v-model="status"
          :items="statusItems"
          class="w-40"
        />
      </UDashboardToolbar>
    </template>

    <div class="grid grid-cols-2 gap-3 max-w-xl">
      <StatTile
        label="This month"
        :value="fmtUzs(data?.month.revenueUzs ?? 0)"
        icon="i-lucide-banknote"
        color="success"
      />
      <StatTile
        label="Paid orders this month"
        :value="data?.month.paid ?? 0"
        icon="i-lucide-receipt"
        color="neutral"
      />
    </div>

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <UTable
        :data="data?.items ?? []"
        :columns="columns"
        :loading="loadState === 'pending'"
      >
        <template #number-cell="{ row }">
          <span class="tabular-nums text-muted">{{ row.original.number }}</span>
        </template>
        <template #user-cell="{ row }">
          <p class="font-medium text-highlighted">
            {{ row.original.user?.name }}
          </p>
          <p class="text-xs text-muted">
            {{ accountHandle(row.original.user) }}
          </p>
          <p class="md:hidden text-xs text-muted mt-0.5">
            {{ row.original.planName }}
          </p>
        </template>
        <template #plan-cell="{ row }">
          <p>{{ row.original.planName }}</p>
          <p class="text-xs text-muted">
            {{ row.original.provider === 'click' ? 'Click' : 'Granted' }}<span v-if="row.original.note"> · {{ row.original.note }}</span>
          </p>
        </template>
        <template #amount-cell="{ row }">
          <span class="tabular-nums font-medium">{{ fmtUzs(row.original.amountUzs) }}</span>
          <UBadge
            :label="ORDER_STATUS[row.original.status].label"
            :color="ORDER_STATUS[row.original.status].color"
            variant="subtle"
            size="sm"
            class="sm:hidden mt-1"
          />
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :label="ORDER_STATUS[row.original.status].label"
            :color="ORDER_STATUS[row.original.status].color"
            variant="subtle"
          />
        </template>
        <template #date-cell="{ row }">
          <span class="text-sm text-muted">{{ formatDate(row.original.paidAt || row.original.createdAt, true) }}</span>
        </template>
        <template #empty>
          <UEmpty
            icon="i-lucide-receipt"
            title="No orders yet"
            variant="naked"
          />
        </template>
      </UTable>
    </UCard>
    <div
      v-if="(data?.pages ?? 1) > 1"
      class="flex justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="data?.total ?? 0"
        :items-per-page="20"
      />
    </div>
  </AppPage>
</template>
