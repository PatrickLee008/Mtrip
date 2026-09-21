<script setup lang="ts">
/**
 * 折线 / 面积图(Figma `1306:18423` 的 Revenue Trend 折线与 Occupancy Rate Trend 面积)。
 *
 * 几何在 100×100 归一化网格里算完,再用 `preserveAspectRatio="none"` 拉伸铺满容器 ——
 * 描边用 `vector-effect="non-scaling-stroke"` 保持稿面线宽不被横向压扁;
 * 峰值圆点改用百分比定位的 HTML 元素,避免拉伸成椭圆。
 */
import { computed } from 'vue';
import { areaPath, linePoints, peakPoint } from '../helpers';

const WIDTH = 100;
const HEIGHT = 100;

const props = withDefaults(
  defineProps<{
    values: (number | null)[];
    /** line = 稿面 Revenue Trend(带峰值圆点);area = 稿面 Occupancy Rate Trend */
    variant?: 'line' | 'area';
    /** 左上角 Y 轴刻度,自上而下 */
    yLabels?: string[];
    /** 底部 X 轴刻度,等距铺开 */
    xLabels?: string[];
    height?: number;
    marker?: boolean;
  }>(),
  { variant: 'line', yLabels: () => [], xLabels: () => [], height: 100, marker: true },
);

const points = computed(() => linePoints(props.values, WIDTH, HEIGHT, 8, 8));
const area = computed(() => areaPath(points.value, WIDTH, HEIGHT));
const peak = computed(() => peakPoint(props.values, WIDTH, HEIGHT, 8, 8));
const strokeWidth = computed(() => (props.variant === 'area' ? 2 : 2.5));
</script>

<template>
  <div class="line-chart">
    <div class="plot" :style="{ height: `${height}px` }">
      <div class="grid-lines">
        <i v-for="line in 5" :key="line" />
      </div>
      <svg class="canvas" :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" preserveAspectRatio="none">
        <defs v-if="variant === 'area'">
          <linearGradient id="ea-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(59, 91, 246, 0.19)" />
            <stop offset="100%" stop-color="rgba(59, 91, 246, 0)" />
          </linearGradient>
        </defs>
        <path v-if="variant === 'area'" :d="area" fill="url(#ea-area-gradient)" stroke="none" />
        <polyline
          :points="points"
          fill="none"
          stroke="#4169ED"
          :stroke-width="strokeWidth"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <div v-if="yLabels.length" class="y-axis">
        <span v-for="label in yLabels" :key="label">{{ label }}</span>
      </div>
      <span
        v-if="marker && peak.index >= 0"
        class="peak-dot"
        :style="{ left: `${peak.x}%`, top: `${peak.y}%` }"
      />
    </div>
    <div v-if="xLabels.length" class="x-axis">
      <span v-for="label in xLabels" :key="label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.line-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.plot {
  position: relative;
  width: 100%;
}

.grid-lines {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  i {
    display: block;
    width: 100%;
    height: 1px;
    background: @ea-line;
  }
}

.canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.y-axis {
  position: absolute;
  inset: 0 auto 0 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: @ea-ink-aux;
  font-family: @ea-font-body;
  font-size: 10px;
  line-height: 1;
}

.peak-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 1.5px solid #ffffff;
  border-radius: 50%;
  background: @ea-danger;
  transform: translate(-50%, -50%);
}

.x-axis {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
  color: @ea-ink-aux;
  font-family: @ea-font-body;
  font-size: 10px;
}
</style>
