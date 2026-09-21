<script setup lang="ts">
/**
 * 30 天营收趋势折线卡(Figma `1306:18423` charts-grid grid-row-1 左)。
 *
 * 与 financial-row 的每日营收柱状图同标题但口径不同:这里是**趋势形态 + 峰值标注**
 * (稿面右上角绿字 "Peak: Oct 20",折线最高点带红色圆点)。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DashboardTrendItem } from '@/api/stats';
import { axisScale, monthDayLabel, peakOf, sampleLabels } from '../helpers';
import ChartPanel from './ChartPanel.vue';
import EaLineChart from './EaLineChart.vue';

const props = defineProps<{ trend: DashboardTrendItem[] }>();

const { t } = useI18n();

const values = computed(() => props.trend.map((item) => item.salesAmount));
const peak = computed(() => peakOf(props.trend));
const yLabels = computed(() => axisScale(Math.max(...values.value, 0), 2));
const xLabels = computed(() => sampleLabels(props.trend.map((item) => item.date), 5));
</script>

<template>
  <ChartPanel :title="t('earnings.charts.revenue')" bordered :padding="20">
    <template #aside>
      <span v-if="peak" class="peak-badge">{{ t('earnings.charts.peak', { date: monthDayLabel(peak.date) }) }}</span>
    </template>
    <EaLineChart :values="values" variant="line" :y-labels="yLabels" :x-labels="xLabels" :height="100" />
  </ChartPanel>
</template>

<style scoped lang="less">
@import '../tokens.less';

.peak-badge {
  color: @ea-success;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 500;
}
</style>
