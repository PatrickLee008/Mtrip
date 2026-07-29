<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { message } from 'ant-design-vue';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { exportCsv } from '@/utils/export';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList, apiMerchantStatement, apiMerchantStatistics } from '@/api/merchant';

const { t } = useI18n();

/** 商户统计:经营数据卡片(默认近30天)+ 结算对账单 */
const SETTLE_STATUS = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('status.pending'), color: 'warning' },
  1: { text: t('common.confirm'), color: 'processing' },
  2: { text: t('common.success'), color: 'success' },
  3: { text: t('common.failed'), color: 'error' },
}));

const merchantOptions = ref<{ label: string; value: number }[]>([]);
const merchantId = ref<number>();
const searching = ref(false);
const dateRange = ref<string[]>([]);

async function searchMerchant(keyword: string): Promise<void> {
  searching.value = true;
  try {
    const data = await apiMerchantList({ merchantName: keyword, page: 1, pageSize: 20 });
    merchantOptions.value = data.list.map((row: TableRow) => ({
      label: `#${row.id} ${row.merchant_name}`,
      value: row.id,
    }));
  } finally {
    searching.value = false;
  }
}

// ---------- 经营统计 ----------
const statsLoading = ref(false);
const stats = reactive({
  startDate: '',
  endDate: '',
  orderCount: 0,
  paidCount: 0,
  salesAmount: 0,
  commission: 0,
  refundAmount: 0,
  merchantReceivable: 0,
  onSaleGoods: 0,
});

const statement = useTable(
  (params) => apiMerchantStatement({ ...params, merchantId: merchantId.value }),
  { settleCycle: '', status: undefined },
);

async function loadAll(): Promise<void> {
  if (!merchantId.value) {
    message.warning(t('merchant.accountPage.merchant'));
    return;
  }
  statsLoading.value = true;
  try {
    const data = await apiMerchantStatistics({
      merchantId: merchantId.value,
      startDate: dateRange.value[0] ?? '',
      endDate: dateRange.value[1] ?? '',
    });
    Object.assign(stats, data);
  } finally {
    statsLoading.value = false;
  }
  statement.search();
}

const statementColumns = computed(() => [
  { title: t('finance.settlePage.settleNo'), dataIndex: 'settle_no', width: 190 },
  { title: t('finance.settlePage.period'), dataIndex: 'settle_cycle', width: 160 },
  { title: t('finance.settlePage.orderAmount'), dataIndex: 'order_amount', width: 110 },
  { title: t('finance.settlePage.commission'), dataIndex: 'commission_amount', width: 110 },
  { title: t('finance.settlePage.refundAmount'), dataIndex: 'refund_amount', width: 110 },
  { title: t('finance.settlePage.settleAmount'), dataIndex: 'settle_amount', width: 120 },
  { title: t('finance.settlePage.status'), dataIndex: 'status', width: 90 },
  { title: t('finance.settlePage.time'), dataIndex: 'pay_time', width: 165 },
]);

function exportStatement(): void {
  if (!statement.list.value.length) {
    message.warning(t('tip.empty'));
    return;
  }
  exportCsv(
    `${t('finance.msettlePage.title')}_${merchantId.value}`,
    statementColumns.value.map((col) => ({ title: col.title, key: col.dataIndex })),
    statement.list.value,
  );
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item :label="t('merchant.accountPage.merchant')">
          <a-select
            v-model:value="merchantId"
            show-search
            :filter-option="false"
            :options="merchantOptions"
            :loading="searching"
            :placeholder="t('common.pleaseInput')"
            style="width: 300px"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item :label="t('finance.overviewPage.trend')">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="loadAll"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-spin :spinning="statsLoading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic :title="t('finance.overviewPage.totalIncome')" :value="stats.salesAmount" :precision="2" />
            <div class="stat-aux">{{ t('order.goods') }} {{ stats.orderCount }} / {{ t('order.status') }} {{ stats.paidCount }}</div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic :title="t('finance.overviewPage.platformCommission')" :value="stats.commission" :precision="2" />
            <div class="stat-aux">{{ t('finance.overviewPage.trend') }} {{ stats.startDate || '-' }} ~ {{ stats.endDate || '-' }}</div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic :title="t('finance.settlePage.refundAmount')" :value="stats.refundAmount" :precision="2" :value-style="{ color: '#fa541c' }" />
            <div class="stat-aux">{{ t('finance.overviewPage.pendingRefund') }}</div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic :title="t('finance.msettlePage.title')" :value="stats.merchantReceivable" :precision="2" :value-style="{ color: '#52c41a' }" />
            <div class="stat-aux">{{ t('goods.common.statusOnsale') }} {{ stats.onSaleGoods }}</div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>{{ t('finance.msettlePage.title') }}</template>
      <template #extra>
        <a-space>
          <a-input v-model:value="statement.query.settleCycle" allow-clear :placeholder="t('finance.settlePage.period')" style="width: 170px" />
          <a-select v-model:value="statement.query.status" allow-clear :placeholder="t('common.status')" style="width: 110px">
            <a-select-option :value="0">{{ SETTLE_STATUS[0].text }}</a-select-option>
            <a-select-option :value="1">{{ SETTLE_STATUS[1].text }}</a-select-option>
            <a-select-option :value="2">{{ SETTLE_STATUS[2].text }}</a-select-option>
            <a-select-option :value="3">{{ SETTLE_STATUS[3].text }}</a-select-option>
          </a-select>
          <a-button :disabled="!merchantId" @click="statement.search()">{{ t('common.search') }}</a-button>
          <a-button v-perm="'merchant:stats:export'" :disabled="!merchantId" @click="exportStatement">
            <template #icon><DownloadOutlined /></template>{{ t('common.export') }}
          </a-button>
        </a-space>
      </template>
      <a-table
        :columns="statementColumns"
        :data-source="statement.list.value"
        :loading="statement.loading.value"
        :pagination="statement.pagination.value"
        row-key="id"
        size="middle"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <StatusTag :value="record.status" :map="SETTLE_STATUS" />
          </template>
          <template v-else-if="['order_amount', 'commission_amount', 'refund_amount', 'settle_amount'].includes(String(column.dataIndex))">
            {{ formatAmount(record[column.dataIndex]) }}
          </template>
        </template>
      </a-table>
      <a-empty v-if="!merchantId" :description="t('common.pleaseSelect')" style="margin: 40px 0" />
    </a-card>
  </PageContainer>
</template>

<style scoped lang="less">
.stat-aux {
  margin-top: 8px;
  font-size: 12px;
  color: var(--mtrip-text-aux, #909399);
}
</style>
