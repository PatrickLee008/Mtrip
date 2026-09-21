<script setup lang="ts">
/**
 * 入住率趋势面积卡(Figma `1306:18423` charts-grid grid-row-1 右)。
 * 稿面右上角蓝字 "Avg: 75%",Y 轴固定 100% / 50% / 0% 三档。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { OccupancyTrendItem } from '@/api/stats';
import { averageOccupancy, formatPercent, sampleLabels } from '../helpers';
import ChartPanel from './ChartPanel.vue';
import EaLineChart from './EaLineChart.vue';

const props = defineProps<{ items: OccupancyTrendItem[] }>();

const { t } = useI18n();

const values = computed(() => props.items.map((item) => item.occupancyRate));
const average = computed(() => averageOccupancy(props.items));
const yLabels = computed(() => ['100%', '50%', '0%']);
const xLabels = computed(() => sampleLabels(props.items.map((item) => item.date), 5));
</script>

<template>
  <ChartPanel :title="t('earnings.charts.occupancy')" bordered :padding="20">
    <template #aside>
      <span class="avg-badge">{{ t('earnings.charts.avg', { value: formatPercent(average) }) }}</span>
    </template>
    <EaLineChart :values="values" variant="area" :y-labels="yLabels" :x-labels="xLabels" :height="100" :marker="false" />
  </ChartPanel>
</template>

<style scoped lang="less">
@import '../tokens.less';

.avg-badge {
  color: @ea-primary;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 500;
}
</style>
