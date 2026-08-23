<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';

const props = withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  option: EChartsOption;
  height?: number;
}>(), {
  subtitle: '',
  height: 180,
});

const el = ref<HTMLDivElement | null>(null);
const chart = shallowRef<ECharts | null>(null);
let resizeObserver: ResizeObserver | null = null;

function render(): void {
  if (!el.value) return;
  if (!chart.value) {
    chart.value = echarts.init(el.value);
  }
  chart.value.setOption(props.option, true);
}

onMounted(() => {
  render();
  if (el.value) {
    resizeObserver = new ResizeObserver(() => chart.value?.resize());
    resizeObserver.observe(el.value);
  }
});

watch(() => props.option, render, { deep: true });

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  chart.value?.dispose();
  chart.value = null;
});
</script>

<template>
  <a-card :bordered="false" class="mtrip-card-shadow chart-card">
    <div class="chart-head">
      <div>
        <div class="chart-title">{{ title }}</div>
        <div v-if="subtitle" class="chart-subtitle">{{ subtitle }}</div>
      </div>
    </div>
    <div ref="el" class="chart-body" :style="{ height: `${height}px` }" />
  </a-card>
</template>

<style scoped lang="less">
.chart-card :deep(.ant-card-body) {
  padding: 16px;
}

.chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
}

.chart-title {
  color: var(--mtrip-text-main);
  font-size: 12px;
  font-weight: 700;
}

.chart-subtitle {
  margin-top: 2px;
  color: var(--mtrip-text-aux);
  font-size: 11px;
}

.chart-body {
  width: 100%;
}
</style>
