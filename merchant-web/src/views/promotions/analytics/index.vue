<script setup lang="ts">
/**
 * M8 促销效果分析(功能需求「通过工作台和分析工具监控促销与活动表现」)。
 *
 * 稿面没有这一页,沿用 Promotions 页同一套设计令牌与卡片/表格形状新设计:
 * 指标卡(曝光/领券/预订/转化/促销收益/商户出资/ROI)+ 趋势图 + 各促销明细表。
 *
 * 口径全部来自后端 `GET /merchant/promotions/performance`(真算,不估算):
 * 曝光来自 C 端上报的 `marketing_promotion_impression`,收益与出资来自
 * `finance_account_entry`(按领券记录 ID 关联券模板)。
 */
import { computed, onMounted, ref } from 'vue';
import type { EChartsOption } from 'echarts';
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';
import EChartCard from '@/components/EChartCard.vue';
import PromoIcon from '../components/PromoIcon.vue';
import {
  apiPromotionOptions,
  apiPromotionPerformance,
  type PromotionPerformance,
  type PromotionPerformanceRow,
} from '@/api/promotions';
import { performanceDiscountText, percentText, roiText, thousands } from '../helpers';

const { t } = useI18n();

const RANGES = ['7d', '30d', '90d', 'all'] as const;
/** 接口参数值 → i18n 词条后缀(7d → d7) */
const RANGE_KEYS: Record<string, string> = { '7d': 'd7', '30d': 'd30', '90d': 'd90', all: 'all' };

const loading = ref(false);
const range = ref<string>('30d');
const currency = ref<string>('THB');
const data = ref<PromotionPerformance>({
  range: '30d',
  from: null,
  impressions: 0,
  claims: 0,
  redemptions: 0,
  bookings: 0,
  conversionRate: 0,
  promotionRevenue: 0,
  merchantFunding: 0,
  platformFunding: 0,
  discountTotal: 0,
  roi: 0,
  list: [],
  trend: [],
});

/** `money` 与 `number` 两类格式,避免每个指标各写一段模板 */
const metrics = computed(() => [
  { key: 'impressions', icon: 'eye', tone: 'primary', value: thousands(data.value.impressions), label: t('promotions.performance.metrics.impressions'), sub: t('promotions.performance.metrics.impressionsSub') },
  { key: 'claims', icon: 'ticket', tone: 'success', value: thousands(data.value.claims), label: t('promotions.performance.metrics.claims'), sub: t('promotions.performance.metrics.claimsSub') },
  { key: 'bookings', icon: 'shopping-bag', tone: 'primary', value: thousands(data.value.bookings), label: t('promotions.performance.metrics.bookings'), sub: t('promotions.performance.metrics.bookingsSub') },
  { key: 'conversion', icon: 'target', tone: 'warn', value: percentText(data.value.conversionRate), label: t('promotions.performance.metrics.conversion'), sub: t('promotions.performance.metrics.conversionSub') },
  { key: 'revenue', icon: 'coins', tone: 'success', value: `${currency.value} ${thousands(data.value.promotionRevenue)}`, label: t('promotions.performance.metrics.revenue'), sub: t('promotions.performance.metrics.revenueSub') },
  { key: 'funding', icon: 'wallet', tone: 'warn', value: `${currency.value} ${thousands(data.value.merchantFunding)}`, label: t('promotions.performance.metrics.funding'), sub: t('promotions.performance.metrics.fundingSub') },
  { key: 'roi', icon: 'trending-up', tone: 'primary', value: `${roiText(data.value.roi)}x`, label: t('promotions.performance.metrics.roi'), sub: t('promotions.performance.metrics.roiSub') },
]);

const trendOption = computed<EChartsOption>(() => ({
  grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
  tooltip: { trigger: 'axis' },
  legend: { data: [t('promotions.performance.columns.impressions'), t('promotions.performance.columns.claims')], right: 0, top: 0 },
  xAxis: { type: 'category', boundaryGap: false, data: data.value.trend.map((point) => point.date.slice(5)) },
  yAxis: { type: 'value' },
  series: [
    { name: t('promotions.performance.columns.impressions'), type: 'line', smooth: true, showSymbol: false, data: data.value.trend.map((point) => point.impressions) },
    { name: t('promotions.performance.columns.claims'), type: 'line', smooth: true, showSymbol: false, data: data.value.trend.map((point) => point.claims) },
  ],
}));

function discountOf(row: PromotionPerformanceRow): string {
  return performanceDiscountText(row, currency.value);
}

async function load(): Promise<void> {
  loading.value = true;
  try {
    data.value = await apiPromotionPerformance({ range: range.value });
  } finally {
    loading.value = false;
  }
}

function pickRange(next: string): void {
  if (range.value === next) return;
  range.value = next;
  void load();
}

onMounted(async () => {
  const options = await apiPromotionOptions();
  currency.value = options.currency || 'THB';
  await load();
});
</script>

<template>
  <PageContainer>
    <div class="analytics-page">
      <header class="page-head">
        <div class="titles">
          <h1>{{ t('promotions.performance.title') }}</h1>
          <p>{{ t('promotions.performance.subtitle') }}</p>
        </div>
        <div class="range-switch">
          <button
            v-for="item in RANGES"
            :key="item"
            type="button"
            class="range-btn"
            :class="{ active: range === item }"
            @click="pickRange(item)"
          >
            {{ t(`promotions.performance.range.${RANGE_KEYS[item]}`) }}
          </button>
        </div>
      </header>

      <a-spin :spinning="loading">
        <section class="metric-row">
          <article v-for="metric in metrics" :key="metric.key" class="metric-card">
            <div class="metric-head">
              <span class="metric-label">{{ metric.label }}</span>
              <span class="metric-icon" :class="`tone-${metric.tone}`">
                <PromoIcon :name="metric.icon" :size="14" />
              </span>
            </div>
            <div class="metric-value">{{ metric.value }}</div>
            <div class="metric-sub">{{ metric.sub }}</div>
          </article>
        </section>

        <EChartCard :title="t('promotions.performance.trend')" :option="trendOption" :height="220" />

        <section class="detail-card">
          <h2 class="detail-title">{{ t('promotions.performance.detail') }}</h2>
          <div class="t-head">
            <span class="c-name">{{ t('promotions.performance.columns.promotion') }}</span>
            <span class="c-discount">{{ t('promotions.performance.columns.discount') }}</span>
            <span class="c-num">{{ t('promotions.performance.columns.impressions') }}</span>
            <span class="c-num">{{ t('promotions.performance.columns.claims') }}</span>
            <span class="c-num">{{ t('promotions.performance.columns.redemptions') }}</span>
            <span class="c-num">{{ t('promotions.performance.columns.conversion') }}</span>
            <span class="c-num">{{ t('promotions.performance.columns.revenue') }}</span>
            <span class="c-num">{{ t('promotions.performance.columns.funding') }}</span>
            <span class="c-num">{{ t('promotions.performance.columns.roi') }}</span>
          </div>

          <div v-if="data.list.length === 0" class="t-state">{{ t('promotions.performance.detailEmpty') }}</div>
          <template v-else>
            <div v-for="row in data.list" :key="row.id" class="t-row">
            <span class="c-name">{{ row.coupon_name || `${t('promotions.performance.unknownPromotion')}${row.id}` }}</span>
            <span class="c-discount">{{ discountOf(row) }}</span>
            <span class="c-num">{{ thousands(row.impressions) }}</span>
            <span class="c-num">{{ thousands(row.claims) }}</span>
            <span class="c-num">{{ thousands(row.redemptions) }}</span>
            <span class="c-num">{{ percentText(row.conversionRate) }}</span>
            <span class="c-num">{{ `${currency} ${thousands(row.promotionRevenue)}` }}</span>
            <span class="c-num">{{ `${currency} ${thousands(row.merchantFunding)}` }}</span>
            <span class="c-num strong">{{ `${roiText(row.roi)}x` }}</span>
            </div>
          </template>
        </section>

        <p class="hint">{{ t('promotions.performance.hint') }}</p>
      </a-spin>
    </div>
  </PageContainer>
</template>

<style scoped lang="less">
@import '../tokens.less';

.analytics-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
  color: @pr-ink;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.titles {
  h1 {
    margin: 0;
    color: @pr-ink;
    font-family: @pr-font-display;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.5;
  }

  p {
    margin: 4px 0 0;
    color: @pr-ink-muted;
    font-family: @pr-font-body;
    font-size: 14px;
    line-height: 1.5;
  }
}

.range-switch {
  display: flex;
  flex: none;
  gap: 8px;
  padding: 4px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-control;
  background: #fff;
}

.range-btn {
  padding: 8px 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &.active {
    background: @pr-primary-soft;
    color: @pr-primary;
  }
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-card;
  background: @pr-card-bg;
  box-shadow: @pr-shadow-card;
}

.metric-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.metric-label {
  color: @pr-ink-sub;
  font-family: @pr-font-body;
  font-size: 12px;
  font-weight: 500;
}

.metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: @pr-radius-control;

  &.tone-primary {
    background: @pr-primary-soft;
    color: @pr-primary;
  }

  &.tone-warn {
    background: @pr-warn-soft;
    color: @pr-warn;
  }

  &.tone-success {
    background: @pr-success-faint;
    color: @pr-success;
  }
}

.metric-value {
  color: @pr-ink;
  font-family: @pr-font-display;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
}

.metric-sub {
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 11px;
  line-height: 1.5;
}

.detail-card {
  overflow: hidden;
  margin-top: 24px;
  border: 1px solid @pr-line;
  border-radius: @pr-radius-card;
  background: #fff;
}

.detail-title {
  margin: 0;
  padding: 20px 24px 0;
  color: @pr-ink;
  font-family: @pr-font-display;
  font-size: 18px;
  font-weight: 600;
}

.t-head,
.t-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.t-head {
  margin-top: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid @pr-line;
  background: @pr-soft;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.t-row {
  padding: 16px 24px;
  border-bottom: 1px solid @pr-line;
  font-family: @pr-font-body;
  font-size: 13px;

  &:last-child {
    border-bottom: 0;
  }
}

.t-state {
  padding: 48px 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 14px;
  text-align: center;
}

.c-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.c-discount {
  flex: none;
  width: 130px;
  color: @pr-primary;
  font-weight: 700;
}

.c-num {
  flex: none;
  width: 110px;
  text-align: right;

  &.strong {
    color: @pr-primary;
    font-weight: 700;
  }
}

.hint {
  margin: 0;
  color: @pr-ink-muted;
  font-family: @pr-font-body;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 1180px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-card {
    overflow-x: auto;
  }

  .t-head,
  .t-row {
    min-width: 1080px;
  }
}

@media (max-width: 900px) {
  .analytics-page {
    padding: 16px;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
