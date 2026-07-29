<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import SiteTreeSelect from '@/components/SiteTreeSelect.vue';
import EChart from '@/components/EChart.vue';
import { useUserStore } from '@/stores/user';
import { formatAmount } from '@/utils/format';
import type { EChartsCoreOption } from 'echarts/core';
import type { SiteNode } from '@/api/types';
import { apiSiteTree } from '@/api/site';
import { apiStatsDashboard, type DashboardData } from '@/api/stats';

/**
 * 数据大屏(文档 6.4.7):KPI 4 卡片 + 营收趋势折线 + 订单量柱状(酒店/门票双系列)
 * + 站点/商户排行 + 最新订单;区间默认近30天
 */
const userStore = useUserStore();
const isSuper = userStore.profile?.isSuper === true;

const ORDER_STATUS_TEXT: Record<number, string> = {
  0: '待支付',
  1: '已支付',
  2: '已核销',
  3: '已完成',
  4: '已取消',
  5: '退款中',
  6: '已退款',
  7: '已过期',
};

const loading = ref(false);
const data = ref<DashboardData | null>(null);
const dateRange = ref<string[]>([]);
const siteId = ref(0);

async function load(): Promise<void> {
  loading.value = true;
  try {
    data.value = await apiStatsDashboard({
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1],
      siteId: siteId.value,
    });
  } finally {
    loading.value = false;
  }
}

// ---------- 站点名映射(排行榜用) ----------
const siteNameMap = ref<Record<number, string>>({});

function flattenSites(nodes: SiteNode[], map: Record<number, string>): void {
  nodes.forEach((node) => {
    map[node.id] = node.site_name;
    if (node.children?.length) {
      flattenSites(node.children, map);
    }
  });
}

async function loadSites(): Promise<void> {
  const map: Record<number, string> = {};
  flattenSites(await apiSiteTree(), map);
  siteNameMap.value = map;
}

function siteName(id: number): string {
  return siteNameMap.value[id] ?? `站点 #${id}`;
}

onMounted(() => {
  void load();
  void loadSites();
});

// ---------- KPI 卡片 ----------
const kpiCards = computed(() => {
  const kpi = data.value?.kpi;
  return [
    { title: '区间总营收', value: kpi?.salesAmount ?? 0, money: true, color: '#1677ff', suffix: `佣金 ${formatAmount(kpi?.commission ?? 0)}` },
    { title: '今日订单', value: kpi?.todayOrderCount ?? 0, money: false, color: '#52c41a', suffix: `今日销售额 ${formatAmount(kpi?.todaySalesAmount ?? 0)}` },
    { title: '待结算金额', value: kpi?.pendingSettleAmount ?? 0, money: true, color: '#faad14', suffix: `${kpi?.pendingSettleCount ?? 0} 笔待处理` },
    { title: '平台佣金', value: kpi?.commission ?? 0, money: true, color: '#722ed1', suffix: '已支付订单口径' },
  ];
});

// ---------- 营收趋势折线 ----------
const salesOption = computed<EChartsCoreOption>(() => {
  const trend = data.value?.trend ?? [];
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: trend.map((row) => row.date.slice(5)), boundaryGap: false },
    yAxis: { type: 'value' },
    series: [
      {
        name: '销售额',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: trend.map((row) => row.salesAmount),
        itemStyle: { color: '#1677ff' },
        areaStyle: { opacity: 0.12 },
      },
    ],
  };
});

// ---------- 订单量柱状(酒店/门票双系列) ----------
const orderOption = computed<EChartsCoreOption>(() => {
  const trend = data.value?.trend ?? [];
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['酒店', '门票'] },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: trend.map((row) => row.date.slice(5)) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '酒店', type: 'bar', stack: 'order', data: trend.map((row) => row.hotelCount), itemStyle: { color: '#1677ff' } },
      { name: '门票', type: 'bar', stack: 'order', data: trend.map((row) => row.ticketCount), itemStyle: { color: '#52c41a' } },
    ],
  };
});

const rankColumns = [
  { title: '排名', key: 'rank_col', width: 60 },
  { title: '名称', key: 'name_col', ellipsis: true },
  { title: '订单数', dataIndex: 'order_count', width: 80 },
  { title: '销售额', dataIndex: 'sales_amount', width: 120 },
];

const latestColumns = [
  { title: '订单号', dataIndex: 'order_no', width: 190 },
  { title: '类型', dataIndex: 'order_type', width: 70 },
  { title: '商品', dataIndex: 'goods_name', ellipsis: true },
  { title: '金额', dataIndex: 'pay_amount', width: 110 },
  { title: '状态', dataIndex: 'order_status', width: 90 },
  { title: '下单时间', dataIndex: 'created_at', width: 165 },
];
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-space wrap>
        <span>统计区间:</span>
        <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" style="width: 240px" />
        <template v-if="isSuper">
          <span>站点:</span>
          <SiteTreeSelect v-model:value="siteId" allow-all style="width: 180px" />
        </template>
        <a-button type="primary" :loading="loading" @click="load"><template #icon><ReloadOutlined /></template>查询</a-button>
        <span v-if="data" style="color: rgba(0, 0, 0, 0.45)">{{ data.startDate }} ~ {{ data.endDate }}</span>
      </a-space>
    </a-card>

    <!-- KPI 4 卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col v-for="card in kpiCards" :key="card.title" :xs="12" :lg="6">
        <a-card :bordered="false" class="mtrip-card-shadow" :loading="loading">
          <a-statistic
            :title="card.title"
            :value="card.money ? formatAmount(card.value) : card.value"
            :value-style="{ color: card.color, fontWeight: 600 }"
          />
          <div class="kpi-suffix">{{ card.suffix }}</div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 趋势图表 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :xs="24" :lg="14">
        <a-card :bordered="false" class="mtrip-card-shadow" title="营收趋势" :loading="loading">
          <EChart :option="salesOption" height="300px" />
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="10">
        <a-card :bordered="false" class="mtrip-card-shadow" title="订单量(酒店/门票)" :loading="loading">
          <EChart :option="orderOption" height="300px" />
        </a-card>
      </a-col>
    </a-row>

    <!-- 排行榜 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="mtrip-card-shadow" title="站点销售排行 TOP10" :loading="loading">
          <a-table
            :columns="rankColumns"
            :data-source="data?.siteRank ?? []"
            :pagination="false"
            row-key="site_id"
            size="small"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'rank_col'">
                <a-tag :color="index < 3 ? 'gold' : 'default'">{{ index + 1 }}</a-tag>
              </template>
              <template v-else-if="column.key === 'name_col'">{{ siteName(record.site_id) }}</template>
              <template v-else-if="column.dataIndex === 'sales_amount'">{{ formatAmount(record.sales_amount) }}</template>
            </template>
          </a-table>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="12">
        <a-card :bordered="false" class="mtrip-card-shadow" title="商户销售排行 TOP10" :loading="loading">
          <a-table
            :columns="rankColumns"
            :data-source="data?.merchantRank ?? []"
            :pagination="false"
            row-key="merchant_id"
            size="small"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'rank_col'">
                <a-tag :color="index < 3 ? 'gold' : 'default'">{{ index + 1 }}</a-tag>
              </template>
              <template v-else-if="column.key === 'name_col'">{{ record.merchant_name || `商户 #${record.merchant_id}` }}</template>
              <template v-else-if="column.dataIndex === 'sales_amount'">{{ formatAmount(record.sales_amount) }}</template>
            </template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>

    <!-- 最新订单 -->
    <a-card :bordered="false" class="mtrip-card-shadow" title="最新订单" :loading="loading">
      <a-table
        :columns="latestColumns"
        :data-source="data?.latestOrders ?? []"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 900 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'order_type'">
            <a-tag :color="record.order_type === 1 ? 'blue' : 'green'">{{ record.order_type === 1 ? '酒店' : '门票' }}</a-tag>
          </template>
          <template v-else-if="column.dataIndex === 'pay_amount'">{{ formatAmount(record.pay_amount) }}</template>
          <template v-else-if="column.dataIndex === 'order_status'">{{ ORDER_STATUS_TEXT[record.order_status] ?? '-' }}</template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>

<style scoped>
.kpi-suffix {
  margin-top: 8px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}
</style>
