<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption } from 'echarts/core';

/**
 * echarts 轻封装:按需注册折线/柱状/饼图,option 变化自动 setOption,窗口缩放自适应
 */
echarts.use([LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent, CanvasRenderer]);

const props = defineProps<{
  option: EChartsCoreOption;
  height?: string;
}>();

const chartRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | null = null;

function render(): void {
  if (!chart && chartRef.value) {
    chart = echarts.init(chartRef.value);
  }
  chart?.setOption(props.option, { notMerge: true });
}

function onResize(): void {
  chart?.resize();
}

onMounted(() => {
  render();
  window.addEventListener('resize', onResize);
});

watch(() => props.option, render, { deep: true });

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  chart?.dispose();
  chart = null;
});
</script>

<template>
  <div ref="chartRef" :style="{ width: '100%', height: props.height || '320px' }" />
</template>
