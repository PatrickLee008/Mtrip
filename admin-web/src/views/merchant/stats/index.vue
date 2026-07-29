<script setup lang="ts">
import { reactive, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable, type TableRow } from '@/composables/useTable';
import { exportCsv } from '@/utils/export';
import { formatAmount } from '@/utils/format';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiMerchantList, apiMerchantStatement, apiMerchantStatistics } from '@/api/merchant';

/** 商户统计:经营数据卡片(默认近30天)+ 结算对账单 */
const SETTLE_STATUS: Record<number, StatusItem> = {
  0: { text: '待确认', color: 'warning' },
  1: { text: '已确认', color: 'processing' },
  2: { text: '已打款', color: 'success' },
  3: { text: '争议中', color: 'error' },
};

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
    message.warning('请先选择商户');
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

const statementColumns = [
  { title: '结算单号', dataIndex: 'settle_no', width: 190 },
  { title: '结算周期', dataIndex: 'settle_cycle', width: 160 },
  { title: '订单总额', dataIndex: 'order_amount', width: 110 },
  { title: '平台佣金', dataIndex: 'commission_amount', width: 110 },
  { title: '退款扣减', dataIndex: 'refund_amount', width: 110 },
  { title: '应结金额', dataIndex: 'settle_amount', width: 120 },
  { title: '状态', dataIndex: 'status', width: 90 },
  { title: '打款时间', dataIndex: 'pay_time', width: 165 },
];

function exportStatement(): void {
  if (!statement.list.value.length) {
    message.warning('暂无数据可导出');
    return;
  }
  exportCsv(
    `商户对账单_${merchantId.value}`,
    statementColumns.map((col) => ({ title: col.title, key: col.dataIndex })),
    statement.list.value,
  );
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="选择商户">
          <a-select
            v-model:value="merchantId"
            show-search
            :filter-option="false"
            :options="merchantOptions"
            :loading="searching"
            placeholder="输入商户名称搜索"
            style="width: 300px"
            @search="searchMerchant"
          />
        </a-form-item>
        <a-form-item label="统计区间">
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" @click="loadAll"><template #icon><SearchOutlined /></template>查询</a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-spin :spinning="statsLoading">
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic title="销售额(已支付)" :value="stats.salesAmount" :precision="2" />
            <div class="stat-aux">订单 {{ stats.orderCount }} 笔 / 支付 {{ stats.paidCount }} 笔</div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic title="平台佣金" :value="stats.commission" :precision="2" />
            <div class="stat-aux">统计区间 {{ stats.startDate || '-' }} ~ {{ stats.endDate || '-' }}</div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic title="退款额" :value="stats.refundAmount" :precision="2" :value-style="{ color: '#fa541c' }" />
            <div class="stat-aux">已退款到账口径</div>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card :bordered="false" class="mtrip-card-shadow">
            <a-statistic title="商户应收" :value="stats.merchantReceivable" :precision="2" :value-style="{ color: '#52c41a' }" />
            <div class="stat-aux">在售商品 {{ stats.onSaleGoods }} 个</div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <template #title>结算对账单</template>
      <template #extra>
        <a-space>
          <a-input v-model:value="statement.query.settleCycle" allow-clear placeholder="结算周期,如 2026-07" style="width: 170px" />
          <a-select v-model:value="statement.query.status" allow-clear placeholder="状态" style="width: 110px">
            <a-select-option :value="0">待确认</a-select-option>
            <a-select-option :value="1">已确认</a-select-option>
            <a-select-option :value="2">已打款</a-select-option>
            <a-select-option :value="3">争议中</a-select-option>
          </a-select>
          <a-button :disabled="!merchantId" @click="statement.search()">查询</a-button>
          <a-button v-perm="'merchant:stats:export'" :disabled="!merchantId" @click="exportStatement">
            <template #icon><DownloadOutlined /></template>导出
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
      <a-empty v-if="!merchantId" description="请先选择商户" style="margin: 40px 0" />
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
