<script setup lang="ts">
/**
 * 预订量趋势卡(Figma `1306:18423` charts-grid grid-row-2 左)。
 * 稿面是 Mon–Sun 七根柱,按索引交替主色 / 次色(#4169ED / #D9E1FB)。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DashboardTrendItem } from '@/api/stats';
import { weekdayBuckets } from '../helpers';
import ChartPanel from './ChartPanel.vue';
import EaBarChart from './EaBarChart.vue';

const props = defineProps<{ trend: DashboardTrendItem[] }>();

const { t } = useI18n();

const bars = computed(() => weekdayBuckets(props.trend));
</script>

<template>
  <ChartPanel :title="t('earnings.charts.bookingVolume')" bordered :padding="20">
    <EaBarChart :bars="bars" :height="100" inline-labels alternate :min-height="8" />
  </ChartPanel>
</template>
