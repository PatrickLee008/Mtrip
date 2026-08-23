<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, EyeOutlined, FlagOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import AmountText from '@/components/AmountText.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import {
  apiEarningsOverview,
  apiSettleDetail,
  apiSettleDispute,
  apiSettleList,
  type EarningsOverview,
  type MerchantSettle,
  type SettlementEntry,
} from '@/api/earnings';

const { t } = useI18n();

const emptyOverview: EarningsOverview = {
  startDate: '',
  endDate: '',
  bookingVolume: 0,
  grossRevenue: 0,
  commission: 0,
  discountAmount: 0,
  mtripPays: 0,
  merchantPays: 0,
  netSettlement: 0,
  settlement: {
    pendingAmount: 0,
    processingAmount: 0,
    paidAmount: 0,
    disputedAmount: 0,
    pendingCount: 0,
    processingCount: 0,
    paidCount: 0,
    disputedCount: 0,
  },
};

const overview = ref<EarningsOverview>(emptyOverview);
const overviewLoading = ref(false);

const { loading, list, query, load, search, reset, pagination } = useTable(apiSettleList, {
  settleNo: '',
  settleCycle: '',
  status: undefined,
});

const statusMap = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('earnings.status.pending'), color: 'warning' },
  1: { text: t('earnings.status.processing'), color: 'processing' },
  2: { text: t('earnings.status.paid'), color: 'success' },
  3: { text: t('earnings.status.disputed'), color: 'error' },
}));

const columns = computed(() => [
  { title: t('earnings.settleNo'), dataIndex: 'settle_no', width: 180 },
  { title: t('earnings.cycle'), dataIndex: 'settle_cycle', width: 150 },
  { title: t('earnings.orderCount'), dataIndex: 'order_count', width: 110 },
  { title: t('earnings.orderAmount'), dataIndex: 'order_amount', width: 130 },
  { title: t('earnings.commission'), dataIndex: 'commission', width: 130 },
  { title: t('earnings.taxAmount'), dataIndex: 'tax_amount', width: 120 },
  { title: t('earnings.settleAmount'), dataIndex: 'settle_amount', width: 140 },
  { title: t('common.status'), dataIndex: 'status', width: 120 },
  { title: t('common.operation'), key: 'action', width: 190, fixed: 'right' as const },
]);

const entryColumns = computed(() => [
  { title: t('order.orderNo'), dataIndex: 'order_no', width: 180 },
  { title: t('earnings.orderAmount'), dataIndex: 'order_amount', width: 120 },
  { title: t('earnings.discountAmount'), dataIndex: 'discount_amount', width: 120 },
  { title: t('earnings.mtripPays'), dataIndex: 'mtrip_pays', width: 120 },
  { title: t('earnings.merchantPays'), dataIndex: 'merchant_pays', width: 130 },
  { title: t('earnings.commission'), dataIndex: 'commission', width: 120 },
  { title: t('earnings.netSettlement'), dataIndex: 'merchant_settlement', width: 140 },
]);

const summaryCards = computed(() => [
  { key: 'bookings', label: t('earnings.cards.bookingVolume'), value: String(overview.value.bookingVolume), sub: t('earnings.cards.currentPeriod') },
  { key: 'gross', label: t('earnings.cards.grossRevenue'), value: money(overview.value.grossRevenue), sub: `${overview.value.startDate} - ${overview.value.endDate}` },
  { key: 'commission', label: t('earnings.cards.commission'), value: money(overview.value.commission), sub: t('earnings.cards.platformFee') },
  { key: 'net', label: t('earnings.cards.netSettlement'), value: money(overview.value.netSettlement), sub: t('earnings.cards.afterDeductions') },
  { key: 'pending', label: t('earnings.cards.pendingPayout'), value: money(overview.value.settlement.pendingAmount + overview.value.settlement.processingAmount), sub: t('earnings.cards.awaitingTransfer') },
  { key: 'paid', label: t('earnings.cards.paidPayout'), value: money(overview.value.settlement.paidAmount), sub: t('earnings.cards.completedPayout') },
]);

const detailOpen = ref(false);
const detailLoading = ref(false);
const detailSettle = ref<MerchantSettle | null>(null);
const detailEntries = ref<SettlementEntry[]>([]);

const disputeOpen = ref(false);
const disputeSaving = ref(false);
const disputeTarget = ref<MerchantSettle | null>(null);
const disputeForm = reactive({ remark: '' });

async function loadOverview(): Promise<void> {
  overviewLoading.value = true;
  try {
    overview.value = await apiEarningsOverview();
  } finally {
    overviewLoading.value = false;
  }
}

async function refreshAll(): Promise<void> {
  await Promise.all([loadOverview(), load()]);
}

async function openDetail(row: TableRow): Promise<void> {
  detailOpen.value = true;
  detailLoading.value = true;
  try {
    const data = await apiSettleDetail(row.id);
    detailSettle.value = data.settle;
    detailEntries.value = data.entries;
  } finally {
    detailLoading.value = false;
  }
}

function openDispute(row: MerchantSettle): void {
  disputeTarget.value = row;
  disputeForm.remark = '';
  disputeOpen.value = true;
}

async function submitDispute(): Promise<void> {
  if (!disputeForm.remark.trim()) {
    message.warning(t('earnings.disputeRequired'));
    return;
  }
  disputeSaving.value = true;
  try {
    await apiSettleDispute({ id: disputeTarget.value!.id, remark: disputeForm.remark.trim() });
    message.success(t('common.opSuccess'));
    disputeOpen.value = false;
    detailOpen.value = false;
    await refreshAll();
  } finally {
    disputeSaving.value = false;
  }
}

function exportCsv(): void {
  const rows = [
    [t('earnings.settleNo'), t('earnings.cycle'), t('earnings.orderAmount'), t('earnings.commission'), t('earnings.settleAmount'), t('common.status')],
    ...list.value.map((item) => [
      item.settle_no,
      item.settle_cycle,
      item.order_amount,
      item.commission,
      item.settle_amount,
      statusMap.value[item.status]?.text ?? item.status,
    ]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `merchant-settlements-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function money(value: number): string {
  return `THB ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

onMounted(() => {
  void refreshAll();
});
</script>

<template>
  <PageContainer>
    <div class="earnings-head">
      <div>
        <h1>{{ t('earnings.title') }}</h1>
        <p>{{ t('earnings.subtitle') }}</p>
      </div>
      <a-space>
        <a-button @click="refreshAll">
          <template #icon><ReloadOutlined /></template>{{ t('common.reset') }}
        </a-button>
        <a-button v-perm="'mch:earnings:export'" type="primary" @click="exportCsv">
          <template #icon><DownloadOutlined /></template>{{ t('earnings.export') }}
        </a-button>
      </a-space>
    </div>

    <a-spin :spinning="overviewLoading">
      <div class="summary-grid">
        <a-card v-for="card in summaryCards" :key="card.key" :bordered="false" class="mtrip-card-shadow summary-card">
          <div class="summary-label">{{ card.label }}</div>
          <div class="summary-value">{{ card.value }}</div>
          <div class="summary-sub">{{ card.sub }}</div>
        </a-card>
      </div>
    </a-spin>

    <a-card :bordered="false" class="mtrip-card-shadow filter-card">
      <a-form layout="inline">
        <a-form-item :label="t('earnings.settleNo')">
          <a-input v-model:value="query.settleNo" allow-clear :placeholder="t('common.pleaseInput')" style="width: 180px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('earnings.cycle')">
          <a-input v-model:value="query.settleCycle" allow-clear placeholder="2026-08" style="width: 150px" @press-enter="search" />
        </a-form-item>
        <a-form-item :label="t('common.status')">
          <a-select v-model:value="query.status" allow-clear :placeholder="t('common.all')" style="width: 150px">
            <a-select-option :value="0">{{ t('earnings.status.pending') }}</a-select-option>
            <a-select-option :value="1">{{ t('earnings.status.processing') }}</a-select-option>
            <a-select-option :value="2">{{ t('earnings.status.paid') }}</a-select-option>
            <a-select-option :value="3">{{ t('earnings.status.disputed') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('earnings.records') }}</template>
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 1200 }">
        <template #bodyCell="{ column, record }">
          <template v-if="['order_amount', 'commission', 'tax_amount', 'settle_amount'].includes(String(column.dataIndex))">
            <AmountText :value="record[column.dataIndex]" :type="column.dataIndex === 'settle_amount' ? 'income' : 'commission'" />
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="statusMap" />
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="0" wrap>
              <a-button type="link" size="small" @click="openDetail(record)">
                <template #icon><EyeOutlined /></template>{{ t('common.detail') }}
              </a-button>
              <a-button
                v-if="[0, 1].includes(record.status)"
                v-perm="'mch:earnings:dispute'"
                type="link"
                size="small"
                danger
                @click="openDispute(record as MerchantSettle)"
              >
                <template #icon><FlagOutlined /></template>{{ t('earnings.dispute') }}
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:open="detailOpen" :title="t('earnings.detailTitle')" width="760">
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="detailSettle" :column="2" bordered size="small" style="margin-bottom: 16px">
          <a-descriptions-item :label="t('earnings.settleNo')">{{ detailSettle.settle_no }}</a-descriptions-item>
          <a-descriptions-item :label="t('earnings.cycle')">{{ detailSettle.settle_cycle }}</a-descriptions-item>
          <a-descriptions-item :label="t('earnings.orderAmount')"><AmountText :value="detailSettle.order_amount" type="income" /></a-descriptions-item>
          <a-descriptions-item :label="t('earnings.commission')"><AmountText :value="detailSettle.commission" type="commission" /></a-descriptions-item>
          <a-descriptions-item :label="t('earnings.refundAmount')"><AmountText :value="detailSettle.refund_amount" type="expense" /></a-descriptions-item>
          <a-descriptions-item :label="t('earnings.taxAmount')"><AmountText :value="detailSettle.tax_amount" type="tax" /></a-descriptions-item>
          <a-descriptions-item :label="t('earnings.settleAmount')"><AmountText :value="detailSettle.settle_amount" type="income" /></a-descriptions-item>
          <a-descriptions-item :label="t('common.status')"><StatusTag :value="detailSettle.status" :map="statusMap" /></a-descriptions-item>
          <a-descriptions-item :label="t('earnings.payTime')">{{ detailSettle.pay_time || '-' }}</a-descriptions-item>
          <a-descriptions-item :label="t('common.remark')">{{ detailSettle.remark || '-' }}</a-descriptions-item>
        </a-descriptions>

        <a-table :columns="entryColumns" :data-source="detailEntries" :pagination="false" row-key="id" size="small" :scroll="{ x: 920 }">
          <template #bodyCell="{ column, record }">
            <template v-if="String(column.dataIndex).includes('amount') || ['commission', 'mtrip_pays', 'merchant_pays', 'merchant_settlement'].includes(String(column.dataIndex))">
              <AmountText :value="record[column.dataIndex]" :type="column.dataIndex === 'merchant_settlement' ? 'income' : 'commission'" />
            </template>
          </template>
        </a-table>
      </a-spin>
      <template #footer>
        <a-space>
          <a-button @click="detailOpen = false">{{ t('common.cancel') }}</a-button>
          <a-button
            v-if="detailSettle && [0, 1].includes(detailSettle.status)"
            v-perm="'mch:earnings:dispute'"
            danger
            @click="openDispute(detailSettle)"
          >
            {{ t('earnings.dispute') }}
          </a-button>
        </a-space>
      </template>
    </a-drawer>

    <a-modal v-model:open="disputeOpen" :title="t('earnings.disputeTitle')" :confirm-loading="disputeSaving" width="520px" @ok="submitDispute">
      <a-alert type="warning" show-icon :message="t('earnings.disputeTip')" style="margin-bottom: 12px" />
      <a-form layout="vertical">
        <a-form-item :label="t('common.remark')" required>
          <a-textarea v-model:value="disputeForm.remark" :rows="4" :placeholder="t('earnings.disputePlaceholder')" />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<style scoped lang="less">
.earnings-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;

  h1 {
    margin: 0;
    color: var(--mtrip-text-main);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  p {
    margin: 4px 0 0;
    color: var(--mtrip-text-secondary);
    font-size: 13px;
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card :deep(.ant-card-body) {
  padding: 16px;
}

.summary-label {
  color: var(--mtrip-text-aux);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.summary-value {
  margin-top: 8px;
  color: var(--mtrip-text-main);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}

.summary-sub {
  margin-top: 6px;
  color: var(--mtrip-text-secondary);
  font-size: 11.5px;
}

.filter-card {
  margin-bottom: 16px;
}

@media (max-width: 900px) {
  .earnings-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
