<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import EChart from '@/components/EChart.vue';
import { useUserStore } from '@/stores/user';
import { exportCsv } from '@/utils/export';
import { formatAmount } from '@/utils/format';
import type { TableRow } from '@/composables/useTable';
import type { EChartsCoreOption } from 'echarts/core';
import { apiFinanceReport, type FinanceReportData } from '@/api/stats';

/**
 * 财务报表(文档 6.4.7):按年 12 个月收入/支出/净额 + 业务类型拆分(成功流水口径)
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const loading = ref(false);
const data = ref<FinanceReportData | null>(null);
const year = ref(new Date().getFullYear());
const siteId = ref(0);

const yearOptions = computed(() => {
  const current = new Date().getFullYear();
  const options: { label: string; value: number }[] = [];
  for (let y = current; y >= current - 5; y -= 1) {
    options.push({ label: `${y} 年`, value: y });
  }
  return options;
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    data.value = await apiFinanceReport({ year: year.value, siteId: siteId.value });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

// ---------- 收支柱状图 ----------
const chartOption = computed<EChartsCoreOption>(() => {
  const list = data.value?.list ?? [];
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出', '净额'] },
    grid: { left: 70, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: list.map((row) => row.month.slice(5) + '月') },
    yAxis: { type: 'value' },
    series: [
      { name: '收入', type: 'bar', data: list.map((row) => row.income), itemStyle: { color: '#52c41a' } },
      { name: '支出', type: 'bar', data: list.map((row) => row.expense), itemStyle: { color: '#ff4d4f' } },
      { name: '净额', type: 'line', smooth: true, data: list.map((row) => row.net), itemStyle: { color: '#1677ff' } },
    ],
  };
});

const columns = [
  { title: '月份', dataIndex: 'month', width: 100 },
  { title: '收入', dataIndex: 'income', width: 130 },
  { title: '支出', dataIndex: 'expense', width: 130 },
  { title: '净额', dataIndex: 'net', width: 130 },
  { title: '订单支付', dataIndex: 'orderPay', width: 120 },
  { title: '订单退款', dataIndex: 'orderRefund', width: 120 },
  { title: '商户提现', dataIndex: 'withdraw', width: 120 },
  { title: '供应商回款', dataIndex: 'supplierPay', width: 120 },
  { title: '手动调账', dataIndex: 'adjust', width: 120 },
];

/** 金额列取值(列 dataIndex 即字段名) */
function cellAmount(record: TableRow, key: string): string {
  return formatAmount(record[key]);
}

// ---------- CSV 导出 ----------
function exportReport(): void {
  const list = data.value?.list ?? [];
  if (list.length === 0) {
    message.info('暂无可导出的报表数据');
    return;
  }
  exportCsv(
    `财务报表_${year.value}`,
    columns.map((col) => ({ title: col.title, key: col.dataIndex })),
    list,
  );
  message.success(`已导出 ${year.value} 年报表`);
}
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-space wrap>
        <span>年度:</span>
        <a-select v-model:value="year" :options="yearOptions" style="width: 120px" />
        <template v-if="isSuper">
          <span>站点:</span>
          <SiteTreeSelect v-model:value="siteId" allow-all style="width: 180px" />
        </template>
        <a-button type="primary" :loading="loading" @click="load"><template #icon><ReloadOutlined /></template>查询</a-button>
      </a-space>
    </a-card>

    <!-- 年度汇总卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :xs="8">
        <a-card :bordered="false" class="mtrip-card-shadow" :loading="loading">
          <a-statistic title="年度总收入" :value="formatAmount(data?.totalIncome ?? 0)" :value-style="{ color: '#52c41a', fontWeight: 600 }" />
        </a-card>
      </a-col>
      <a-col :xs="8">
        <a-card :bordered="false" class="mtrip-card-shadow" :loading="loading">
          <a-statistic title="年度总支出" :value="formatAmount(data?.totalExpense ?? 0)" :value-style="{ color: '#ff4d4f', fontWeight: 600 }" />
        </a-card>
      </a-col>
      <a-col :xs="8">
        <a-card :bordered="false" class="mtrip-card-shadow" :loading="loading">
          <a-statistic title="年度净额" :value="formatAmount(data?.totalNet ?? 0)" :value-style="{ color: '#1677ff', fontWeight: 600 }" />
        </a-card>
      </a-col>
    </a-row>

    <a-card :bordered="false" class="mtrip-card-shadow" title="月度收支趋势" style="margin-bottom: 16px" :loading="loading">
      <EChart :option="chartOption" height="320px" />
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow" :title="`${data?.year ?? year} 年月度明细`">
      <template #extra>
        <a-button v-perm="'stats:finance:export'" @click="exportReport">
          <template #icon><DownloadOutlined /></template>导出CSV
        </a-button>
      </template>
      <a-table
        :columns="columns"
        :data-source="data?.list ?? []"
        :loading="loading"
        :pagination="false"
        row-key="month"
        size="middle"
        :scroll="{ x: 1100 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'income'">
            <span style="color: var(--mtrip-success, #52c41a)">{{ cellAmount(record, 'income') }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'expense'">
            <span style="color: var(--mtrip-error, #ff4d4f)">{{ cellAmount(record, 'expense') }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'net'">
            <span :style="{ color: Number(record.net) >= 0 ? 'var(--mtrip-success, #52c41a)' : 'var(--mtrip-error, #ff4d4f)', fontWeight: 600 }">
              {{ cellAmount(record, 'net') }}
            </span>
          </template>
          <template v-else-if="column.dataIndex !== 'month'">{{ cellAmount(record, String(column.dataIndex)) }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
