<script setup lang="ts">
/**
 * 每日营收柱状图卡(Figma `1306:18423` financial-row 左侧 chart-card)。
 *
 * 与 charts-grid 里的「Revenue Trend (Last 30 Days)」折线图同标题但口径不同:
 * 这张是**每日营收**绝对值(图例 "Daily Revenue"),折线那张是趋势形态 + 峰值。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DashboardTrendItem } from '@/api/stats';
import { monthDayLabel, sampleLabels } from '../helpers';
import ChartPanel from './ChartPanel.vue';
import EaBarChart from './EaBarChart.vue';

const props = defineProps<{ trend: DashboardTrendItem[] }>();

const { t } = useI18n();

const bars = computed(() => props.trend.map((item) => ({ label: monthDayLabel(item.date), value: item.salesAmount })));
const axisLabels = computed(() => sampleLabels(props.trend.map((item) => item.date), 8));
</script>

<template>
  <ChartPanel :title="t('earnings.charts.revenue')" :padding="24">
    <template #aside>
      <span class="legend">
        <span class="legend-dot" />
        {{ t('earnings.charts.dailyRevenue') }}
      </span>
    </template>
    <EaBarChart :bars="bars" :axis-labels="axisLabels" :height="203" />
  </ChartPanel>
</template>

<style scoped lang="less">
@import '../tokens.less';

.legend {
  display: flex;
  align-items: center;
  gap: 8px;
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 500;
}

.legend-dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: @ea-primary;
}
</style>
