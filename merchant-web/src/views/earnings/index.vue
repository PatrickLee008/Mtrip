<script setup lang="ts">
/**
 * Dashboard & Earnings(Figma `fsK2rrl2sadcowrxspvGV8` SECTION `1306:18423`
 * 「Business Dashboard & Settlement」)。
 *
 * 稿面一页 = 页头(标题 + 周期选择 + Export Report)
 *   + 四张概览卡(Today's Arrivals / Departures / Occupancy Rate / Pending Actions)
 *   + financial-row(每日营收柱 + Earnings Breakdown)
 *   + 2×2 图表网格(营收折线 / 入住率面积 / 星期预订量柱 / 房型环形)
 *   + 近期预订结算表 + 导出弹窗。
 *
 * 与 /dashboard 的分工:本页是「经营 + 收益」聚合页(菜单 Business › Dashboard & Earnings),
 * /dashboard 保持原工作台不动。稿面没画的旧块(6 张统计卡、筛选表单、结算单列表 + 详情抽屉 +
 * 申诉弹窗)已随本次重写删除。
 *
 * 图表全部手写 SVG/DOM(与 availability / promotions 两页同处理),不引 echarts:
 * 视觉能逐像素贴稿面令牌,且 SSR 校验脚本可断言(echarts 走 canvas 无法断言)。
 */
import { computed, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import { useDismiss } from '@/composables/useDismiss';
import { apiDashboardStats, type DashboardStats } from '@/api/stats';
import { apiEarningsOverview, type EarningsOverview } from '@/api/earnings';
import EaIcon from './components/EaIcon.vue';
import SummaryCard from './components/SummaryCard.vue';
import SparklineBars from './components/SparklineBars.vue';
import DailyRevenueCard from './components/DailyRevenueCard.vue';
import EarningsBreakdownCard from './components/EarningsBreakdownCard.vue';
import TrendLineCard from './components/TrendLineCard.vue';
import OccupancyAreaCard from './components/OccupancyAreaCard.vue';
import BookingVolumeCard from './components/BookingVolumeCard.vue';
import RoomTypeDonutCard from './components/RoomTypeDonutCard.vue';
import SettlementsTable from './components/SettlementsTable.vue';
import ExportReportModal from './components/ExportReportModal.vue';
import {
  EMPTY_DASHBOARD_STATS,
  EMPTY_EARNINGS_OVERVIEW,
  bookingBadge,
  bookingRef,
  deltaText,
  deductionMoneyText,
  deductionPercentText,
  formatPercent,
  isNegativeDelta,
  isoRangeLabel,
  lastValues,
  moneyText,
  monthLabel,
  normalizeOverview,
  normalizeStats,
  paymentBadge,
  stayRangeLabel,
} from './helpers';

const { t } = useI18n();

type RangeKey = 'thisMonth' | 'lastMonth' | 'last30' | 'last7';

const stats = ref<DashboardStats>(EMPTY_DASHBOARD_STATS);
const overview = ref<EarningsOverview>(EMPTY_EARNINGS_OVERVIEW);
const loading = ref(false);
const rangeKey = ref<RangeKey>('thisMonth');
const range = ref(rangeOf('thisMonth'));

const rangeOpen = ref(false);
const rangeRoot = ref<HTMLElement | null>(null);
useDismiss(rangeRoot, rangeOpen, () => {
  rangeOpen.value = false;
});

const exportOpen = ref(false);

/** 本地日期 → YYYY-MM-DD(不用 toISOString,避免正时区把本地零点算到前一天) */
function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rangeOf(key: RangeKey): { startDate: string; endDate: string } {
  const now = new Date();
  if (key === 'thisMonth') {
    return { startDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: isoDate(now) };
  }
  if (key === 'lastMonth') {
    return {
      startDate: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      endDate: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - (key === 'last30' ? 29 : 6));
  return { startDate: isoDate(start), endDate: isoDate(now) };
}

const rangeOptions = computed(() => [
  { key: 'thisMonth' as RangeKey, label: t('earnings.range.thisMonth', { month: monthLabel(rangeOf('thisMonth').startDate) }) },
  { key: 'lastMonth' as RangeKey, label: t('earnings.range.lastMonth', { month: monthLabel(rangeOf('lastMonth').startDate) }) },
  { key: 'last30' as RangeKey, label: t('earnings.range.last30') },
  { key: 'last7' as RangeKey, label: t('earnings.range.last7') },
]);

const rangeLabel = computed(
  () => rangeOptions.value.find((option) => option.key === rangeKey.value)?.label ?? '',
);

const exportRangeLabel = computed(() => isoRangeLabel(range.value.startDate, range.value.endDate));

/** 结算币种由后端按选中物业下发,未知币种走 format.currencySymbol 的「代码 + 空格」兜底 */
const currency = computed(() => overview.value.currency || 'THB');

const occupancySpark = computed(() => lastValues(stats.value.occupancyTrend, 6).map((item) => item.occupancyRate));

const summaryCards = computed(() => [
  {
    key: 'arrivals',
    label: t('earnings.summary.arrivals'),
    value: t('earnings.summary.guests', { count: stats.value.kpi.todayArrivalGuestCount }),
    sub: t('earnings.summary.groupsRemaining', { count: stats.value.kpi.todayArrivalRemainingCount }),
    icon: 'log-in',
    tone: 'default' as const,
    sparkline: false,
  },
  {
    key: 'departures',
    label: t('earnings.summary.departures'),
    value: t('earnings.summary.guests', { count: stats.value.kpi.todayDepartureGuestCount }),
    sub: stats.value.kpi.todayDeparturePendingCount > 0
      ? t('earnings.summary.checkoutsPending', { count: stats.value.kpi.todayDeparturePendingCount })
      : t('earnings.summary.allCleared'),
    icon: 'log-out',
    tone: 'default' as const,
    sparkline: false,
  },
  {
    key: 'occupancy',
    label: t('earnings.summary.occupancyRate'),
    value: formatPercent(stats.value.kpi.occupancyRate),
    sub: '',
    icon: 'percent',
    tone: 'default' as const,
    sparkline: true,
  },
  {
    key: 'actions',
    label: t('earnings.summary.pendingActions'),
    value: t('earnings.summary.syncErrors', { count: stats.value.kpi.syncErrorCount }),
    sub: stats.value.kpi.syncErrorCount > 0
      ? t('earnings.summary.needsMapping')
      : t('earnings.summary.noActions'),
    icon: 'alert-triangle',
    tone: 'danger' as const,
    sparkline: false,
  },
]);

const occupancyDelta = computed(() => deltaText(stats.value.kpi.occupancyWeekDelta));
const occupancyDeltaNegative = computed(() => isNegativeDelta(stats.value.kpi.occupancyWeekDelta));

async function loadAll(): Promise<void> {
  loading.value = true;
  try {
    const params = { startDate: range.value.startDate, endDate: range.value.endDate };
    const [statsResult, overviewResult] = await Promise.allSettled([
      apiDashboardStats(params),
      apiEarningsOverview(params),
    ]);
    if (statsResult.status === 'fulfilled') {
      stats.value = normalizeStats(statsResult.value);
    }
    if (overviewResult.status === 'fulfilled') {
      overview.value = normalizeOverview(overviewResult.value);
    }
  } finally {
    loading.value = false;
  }
}

function pickRange(key: RangeKey): void {
  rangeKey.value = key;
  range.value = rangeOf(key);
  rangeOpen.value = false;
  void loadAll();
}

/** 结算与收益报表:期间汇总 + 近期逐单明细 */
function settlementReportRows(): string[][] {
  return [
    [t('earnings.exportDialog.typeSettlement')],
    [t('earnings.exportDialog.period'), exportRangeLabel.value],
    [],
    [t('earnings.breakdown.grossRevenue'), moneyText(overview.value.grossRevenue, currency.value)],
    [t('earnings.breakdown.promotions'), deductionMoneyText(overview.value.discountAmount, currency.value)],
    [t('earnings.breakdown.commission'), deductionPercentText(overview.value.commissionRate)],
    [t('earnings.breakdown.netPayout'), moneyText(overview.value.netSettlement, currency.value)],
    [],
    ...bookingReportRows(),
  ];
}

/** 预订营收报表:近期逐单明细 */
function bookingReportRows(): string[][] {
  const header = [
    t('earnings.settlements.bookingId'),
    t('earnings.settlements.guest'),
    t('earnings.settlements.roomType'),
    t('earnings.settlements.stay'),
    t('earnings.settlements.amount'),
    t('earnings.settlements.payment'),
    t('earnings.settlements.status'),
  ];
  const body = stats.value.recentBookings.map((row) => [
    bookingRef(row.orderNo),
    row.guest,
    row.roomType,
    stayRangeLabel(row.checkIn, row.checkOut),
    moneyText(row.totalAmount, currency.value),
    t(`earnings.badge.${paymentBadge(row).key}`),
    t(`earnings.badge.${bookingBadge(row).key}`),
  ]);
  return [header, ...body];
}

function downloadCsv(payload: { reportType: string; format: string }): void {
  const rows = payload.reportType === 'bookings' ? bookingReportRows() : settlementReportRows();
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `merchant-${payload.reportType}-${range.value.startDate}_${range.value.endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  exportOpen.value = false;
  message.success(t('earnings.exportDialog.downloaded'));
}

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <PageContainer>
    <div class="earnings-page">
      <header class="page-head">
        <div class="titles">
          <h1>{{ t('earnings.title') }}</h1>
          <p>{{ t('earnings.subtitle') }}</p>
        </div>
        <div class="actions">
          <div ref="rangeRoot" class="range-picker">
            <button type="button" class="range-btn" :class="{ open: rangeOpen }" @click="rangeOpen = !rangeOpen">
              <EaIcon name="calendar" :size="16" />
              <span>{{ rangeLabel }}</span>
            </button>
            <ul v-if="rangeOpen" class="range-menu">
              <li v-for="option in rangeOptions" :key="option.key">
                <button
                  type="button"
                  class="range-option"
                  :class="{ active: option.key === rangeKey }"
                  @click="pickRange(option.key)"
                >
                  {{ option.label }}
                </button>
              </li>
            </ul>
          </div>
          <button v-perm="'mch:earnings:export'" type="button" class="export-btn" @click="exportOpen = true">
            <EaIcon name="download" :size="16" />
            <span>{{ t('earnings.export') }}</span>
          </button>
        </div>
      </header>

      <a-spin :spinning="loading">
        <div class="main-container">
          <div class="summary-row">
            <SummaryCard
              v-for="card in summaryCards"
              :key="card.key"
              :label="card.label"
              :value="card.value"
              :sub="card.sub"
              :tone="card.tone"
            >
              <template #icon>
                <EaIcon :name="card.icon" :size="18" />
              </template>
              <template v-if="card.sparkline" #body>
                <div class="occupancy-body">
                  <SparklineBars :values="occupancySpark" :count="6" />
                  <span class="delta" :class="{ negative: occupancyDeltaNegative }">
                    {{ t('earnings.summary.thisWeek', { delta: occupancyDelta }) }}
                  </span>
                </div>
              </template>
            </SummaryCard>
          </div>

          <div class="financial-row">
            <DailyRevenueCard :trend="stats.trend" />
            <EarningsBreakdownCard :overview="overview" :currency="currency" />
          </div>

          <div class="charts-grid">
            <div class="grid-row">
              <TrendLineCard :trend="stats.trend" />
              <OccupancyAreaCard :items="stats.occupancyTrend" />
            </div>
            <div class="grid-row">
              <BookingVolumeCard :trend="stats.trend" />
              <RoomTypeDonutCard :items="stats.roomTypePerformance" />
            </div>
          </div>

          <SettlementsTable :rows="stats.recentBookings" :currency="currency" />
        </div>
      </a-spin>

      <ExportReportModal v-model:open="exportOpen" :range-label="exportRangeLabel" @download="downloadCsv" />
    </div>
  </PageContainer>
</template>

<style scoped lang="less">
@import './tokens.less';

.earnings-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h1 {
    margin: 0;
    color: @ea-ink-page;
    font-family: @ea-font-display;
    font-size: 20px;
    font-weight: 700;
    line-height: 1.5;
  }

  p {
    margin: 2px 0 0;
    max-width: 640px;
    color: @ea-ink-sub;
    font-family: @ea-font-body;
    font-size: 14px;
  }
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.range-picker {
  position: relative;
}

.range-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: @ea-control-height;
  padding: 0 16px;
  border: 0;
  border-radius: @ea-radius-control;
  background: #ffffff;
  color: @ea-ink;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;

  &.open {
    box-shadow: 0 0 0 2px @ea-primary-soft;
  }
}

.range-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  min-width: 220px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 1px solid @ea-line;
  border-radius: @ea-radius-control;
  background: #ffffff;
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.08);
}

.range-option {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: @ea-ink-label;
  font-family: @ea-font-body;
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: @ea-soft;
  }

  &.active {
    background: @ea-primary-chip;
    color: @ea-primary;
    font-weight: 600;
  }
}

.export-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: @ea-control-height;
  padding: 0 16px;
  border: 0;
  border-radius: @ea-radius-control;
  background: @ea-primary;
  color: #ffffff;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.main-container {
  display: flex;
  flex-direction: column;
  gap: @ea-row-gap;
  padding: 20px 0;
}

.summary-row {
  display: flex;
  gap: @ea-summary-gap;
}

.occupancy-body {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.delta {
  color: @ea-success;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 600;

  &.negative {
    color: @ea-danger;
  }
}

.financial-row {
  display: flex;
  gap: @ea-row-gap;
}

.charts-grid {
  display: flex;
  flex-direction: column;
  gap: @ea-row-gap;
}

.grid-row {
  display: flex;
  gap: @ea-row-gap;

  > * {
    flex: 1;
    min-width: 0;
  }
}

@media (max-width: 1200px) {
  .summary-row,
  .financial-row,
  .grid-row {
    flex-direction: column;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
