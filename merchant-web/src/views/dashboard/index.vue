<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import type { EChartsOption } from 'echarts';
import {
  ArrowRightOutlined,
  BankOutlined,
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  HomeOutlined,
  ProfileOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag, { type StatusItem } from '@/components/StatusTag.vue';
import AmountText from '@/components/AmountText.vue';
import EChartCard from '@/components/EChartCard.vue';
import { apiDashboardStats, type DashboardStats } from '@/api/stats';

const { t } = useI18n();
const router = useRouter();
const loading = ref(false);

const emptyStats: DashboardStats = {
  updatedAt: '',
  kpi: {
    totalPropertyCount: 0,
    todayBookingCount: 0,
    todayCheckInCount: 0,
    todayCheckOutCount: 0,
    currentGuestCount: 0,
    occupancyRate: null,
    revenueToday: 0,
    pendingConfirmationCount: 0,
    pendingSettleAmount: 0,
    activePromotionCount: 0,
  },
  trend: [],
  propertyPerformance: [],
  todayOperations: [],
  alerts: [],
};

const stats = ref<DashboardStats>(emptyStats);

const orderStatusMap = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('order.statusMap.unpaid'), color: 'warning' },
  1: { text: t('order.statusMap.paid'), color: 'processing' },
  2: { text: t('order.statusMap.used'), color: 'success' },
  3: { text: t('order.statusMap.completed'), color: 'success' },
  4: { text: t('order.statusMap.cancelled'), color: 'default' },
  5: { text: t('order.statusMap.refunding'), color: 'warning' },
  6: { text: t('order.statusMap.refunded'), color: 'error' },
  7: { text: t('order.statusMap.expired'), color: 'default' },
}));

const propertyStatusMap = computed<Record<number, StatusItem>>(() => ({
  0: { text: t('dashboard.propertyStatus.pending'), color: 'warning' },
  1: { text: t('dashboard.propertyStatus.active'), color: 'success' },
  2: { text: t('dashboard.propertyStatus.rejected'), color: 'error' },
  3: { text: t('dashboard.propertyStatus.approved'), color: 'success' },
  4: { text: t('dashboard.propertyStatus.disabled'), color: 'default' },
  5: { text: t('dashboard.propertyStatus.closed'), color: 'default' },
  6: { text: t('dashboard.propertyStatus.resubmit'), color: 'warning' },
}));

const kpiCards = computed(() => [
  {
    key: 'properties',
    label: t('dashboard.kpi.totalProperties'),
    value: String(stats.value.kpi.totalPropertyCount),
    sub: t('dashboard.kpi.managedProperties'),
    icon: HomeOutlined,
    color: '#2563eb',
    bg: '#eff6ff',
    path: '/store',
  },
  {
    key: 'todayBookings',
    label: t('dashboard.kpi.todayBookings'),
    value: String(stats.value.kpi.todayBookingCount),
    sub: t('dashboard.kpi.receivedToday'),
    icon: ProfileOutlined,
    color: '#059669',
    bg: '#ecfdf3',
    path: '/order',
  },
  {
    key: 'checkIns',
    label: t('dashboard.kpi.todayCheckIns'),
    value: String(stats.value.kpi.todayCheckInCount),
    sub: t('dashboard.kpi.arrivingToday'),
    icon: CalendarOutlined,
    color: '#7c3aed',
    bg: '#f5f3ff',
    path: '/order',
  },
  {
    key: 'checkOuts',
    label: t('dashboard.kpi.todayCheckOuts'),
    value: String(stats.value.kpi.todayCheckOutCount),
    sub: t('dashboard.kpi.departingToday'),
    icon: CheckCircleOutlined,
    color: '#475569',
    bg: '#f1f5f9',
    path: '/order',
  },
  {
    key: 'guests',
    label: t('dashboard.kpi.currentGuests'),
    value: String(stats.value.kpi.currentGuestCount),
    sub: t('dashboard.kpi.inHouseNow'),
    icon: TeamOutlined,
    color: '#4f46e5',
    bg: '#eef2ff',
    path: '/order',
  },
  {
    key: 'occupancy',
    label: t('dashboard.kpi.occupancyRate'),
    value: stats.value.kpi.occupancyRate === null ? '-' : `${stats.value.kpi.occupancyRate}%`,
    sub: t('dashboard.kpi.waitingInventory'),
    icon: BankOutlined,
    color: '#0f766e',
    bg: '#f0fdfa',
    path: '/availability',
  },
  {
    key: 'revenue',
    label: t('dashboard.kpi.revenueToday'),
    value: formatCompactMoney(stats.value.kpi.revenueToday),
    sub: t('dashboard.kpi.paidToday'),
    icon: DollarOutlined,
    color: '#059669',
    bg: '#ecfdf3',
    path: '/earnings',
  },
  {
    key: 'pending',
    label: t('dashboard.kpi.pendingConfirmations'),
    value: String(stats.value.kpi.pendingConfirmationCount),
    sub: t('dashboard.kpi.awaitingAction'),
    icon: ClockCircleOutlined,
    color: '#d97706',
    bg: '#fffbeb',
    path: '/order',
  },
  {
    key: 'settle',
    label: t('dashboard.kpi.pendingSettlement'),
    value: formatCompactMoney(stats.value.kpi.pendingSettleAmount),
    sub: t('dashboard.kpi.awaitingPayout'),
    icon: BankOutlined,
    color: '#7c3aed',
    bg: '#f5f3ff',
    path: '/earnings',
  },
  {
    key: 'promotions',
    label: t('dashboard.kpi.activePromotions'),
    value: String(stats.value.kpi.activePromotionCount),
    sub: t('dashboard.kpi.waitingMarketing'),
    icon: BellOutlined,
    color: '#e11d48',
    bg: '#fff1f2',
    path: '/promotions',
  },
]);

const trendDates = computed(() => stats.value.trend.map((item) => item.date.slice(5)));

const revenueOption = computed<EChartsOption>(() => lineOption(
  t('dashboard.charts.revenue'),
  trendDates.value,
  stats.value.trend.map((item) => item.salesAmount),
  '#059669',
));

const bookingOption = computed<EChartsOption>(() => barOption(
  t('dashboard.charts.bookings'),
  trendDates.value,
  stats.value.trend.map((item) => item.bookingCount),
  '#2563eb',
));

const propertyColumns = computed(() => [
  { title: t('dashboard.property.name'), dataIndex: 'propertyName', ellipsis: true },
  { title: t('dashboard.property.todayBookings'), dataIndex: 'todayBookings', width: 140 },
  { title: t('dashboard.property.occupancy'), dataIndex: 'occupancyRate', width: 120 },
  { title: t('dashboard.property.revenueToday'), dataIndex: 'revenueToday', width: 140 },
  { title: t('common.status'), dataIndex: 'status', width: 110 },
]);

const operationColumns = computed(() => [
  { title: t('dashboard.operations.hotel'), dataIndex: 'hotel', width: 180, ellipsis: true },
  { title: t('order.orderNo'), dataIndex: 'orderNo', width: 180 },
  { title: t('dashboard.operations.guest'), dataIndex: 'guest', width: 110 },
  { title: t('dashboard.operations.room'), dataIndex: 'room', ellipsis: true },
  { title: t('dashboard.operations.checkIn'), dataIndex: 'checkIn', width: 120 },
  { title: t('dashboard.operations.checkOut'), dataIndex: 'checkOut', width: 120 },
  { title: t('common.status'), dataIndex: 'status', width: 120 },
]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    stats.value = await apiDashboardStats();
  } finally {
    loading.value = false;
  }
}

function go(path: string): void {
  void router.push(path);
}

function formatCompactMoney(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `THB ${(value / 1000).toFixed(1)}K`;
  }
  return `THB ${Number(value || 0).toLocaleString()}`;
}

function lineOption(name: string, x: string[], data: number[], color: string): EChartsOption {
  return {
    grid: { top: 16, right: 10, bottom: 22, left: 42 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x, axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: 'value', axisTick: { show: false }, axisLine: { show: false }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      name,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2, color },
      areaStyle: { color: 'rgba(5, 150, 105, 0.12)' },
      data,
    }],
  };
}

function barOption(name: string, x: string[], data: number[], color: string): EChartsOption {
  return {
    grid: { top: 16, right: 10, bottom: 22, left: 32 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x, axisTick: { show: false }, axisLine: { show: false } },
    yAxis: { type: 'value', axisTick: { show: false }, axisLine: { show: false }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{ name, type: 'bar', barWidth: 14, itemStyle: { color, borderRadius: [4, 4, 0, 0] }, data }],
  };
}

onMounted(() => {
  void load();
});
</script>

<template>
  <PageContainer>
    <a-spin :spinning="loading">
      <div class="dash-head">
        <div>
          <h1>{{ t('dashboard.title') }}</h1>
          <p>{{ t('dashboard.subtitle') }}</p>
        </div>
        <div class="sync-pill">
          <span class="sync-dot" />
          {{ stats.updatedAt ? t('dashboard.lastSync', { time: stats.updatedAt }) : t('dashboard.loading') }}
        </div>
      </div>

      <div class="alert-row">
        <div v-for="alert in stats.alerts" :key="alert.type" class="alert-card">
          <WarningOutlined class="alert-icon" />
          <div>
            <div class="alert-title">{{ t(alert.title) }}</div>
            <div class="alert-text">{{ t(alert.message) }}</div>
          </div>
        </div>
      </div>

      <div class="kpi-grid">
        <button v-for="item in kpiCards" :key="item.key" class="kpi-card" @click="go(item.path)">
          <div class="kpi-top">
            <span class="kpi-icon" :style="{ color: item.color, background: item.bg }">
              <component :is="item.icon" />
            </span>
            <ArrowRightOutlined class="kpi-arrow" />
          </div>
          <div class="kpi-value">{{ item.value }}</div>
          <div class="kpi-label">{{ item.label }}</div>
          <div class="kpi-sub">{{ item.sub }}</div>
        </button>
      </div>

      <a-row :gutter="[16, 16]" class="chart-row">
        <a-col :xs="24" :lg="12">
          <EChartCard :title="t('dashboard.charts.revenue')" :subtitle="t('dashboard.charts.last7Days')" :option="revenueOption" />
        </a-col>
        <a-col :xs="24" :lg="12">
          <EChartCard :title="t('dashboard.charts.bookings')" :subtitle="t('dashboard.charts.last7Days')" :option="bookingOption" />
        </a-col>
      </a-row>

      <a-card :bordered="false" class="mtrip-card-shadow dashboard-table">
        <template #title>{{ t('dashboard.property.title') }}</template>
        <template #extra>
          <a-button type="link" @click="go('/store')">{{ t('dashboard.viewAllProperties') }}</a-button>
        </template>
        <a-table :columns="propertyColumns" :data-source="stats.propertyPerformance" :pagination="false" row-key="propertyId" size="middle">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'occupancyRate'">
              <span>{{ record.occupancyRate === null ? '-' : `${record.occupancyRate}%` }}</span>
            </template>
            <template v-else-if="column.dataIndex === 'revenueToday'">
              <AmountText :value="record.revenueToday" type="income" />
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <StatusTag :value="record.status" :map="propertyStatusMap" />
            </template>
          </template>
        </a-table>
      </a-card>

      <a-card :bordered="false" class="mtrip-card-shadow dashboard-table">
        <template #title>{{ t('dashboard.operations.title') }}</template>
        <template #extra>
          <a-button type="link" @click="go('/order')">{{ t('dashboard.viewAllBookings') }}</a-button>
        </template>
        <a-table :columns="operationColumns" :data-source="stats.todayOperations" :pagination="false" row-key="orderId" size="middle" :scroll="{ x: 960 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'orderNo'">
              <a-button type="link" size="small" @click="go('/order')">{{ record.orderNo }}</a-button>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <StatusTag :value="record.status" :map="orderStatusMap" />
            </template>
          </template>
        </a-table>
      </a-card>
    </a-spin>
  </PageContainer>
</template>

<style scoped lang="less">
.dash-head {
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

.sync-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #166534;
  font-size: 12px;
  font-weight: 600;
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
}

.alert-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.alert-card {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #fde68a;
  border-radius: 10px;
  background: #fffbeb;
}

.alert-icon {
  margin-top: 2px;
  color: #d97706;
}

.alert-title {
  color: #92400e;
  font-size: 12px;
  font-weight: 700;
}

.alert-text {
  margin-top: 2px;
  color: #b45309;
  font-size: 12px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.kpi-card {
  padding: 16px;
  border: 1px solid var(--mtrip-border);
  border-radius: 12px;
  background: #ffffff;
  box-shadow: var(--mtrip-shadow-card);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: #bfdbfe;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.08);
    transform: translateY(-1px);
  }
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.kpi-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 15px;
}

.kpi-arrow {
  color: #cbd5e1;
  font-size: 12px;
}

.kpi-value {
  color: var(--mtrip-text-main);
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
}

.kpi-label {
  margin-top: 6px;
  color: #334155;
  font-size: 11.5px;
  font-weight: 700;
}

.kpi-sub {
  margin-top: 2px;
  color: var(--mtrip-text-aux);
  font-size: 11px;
}

.chart-row {
  margin-bottom: 16px;
}

.dashboard-table + .dashboard-table {
  margin-top: 16px;
}

@media (max-width: 1200px) {
  .kpi-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .dash-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .kpi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
