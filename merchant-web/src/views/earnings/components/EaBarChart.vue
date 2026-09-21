<script setup lang="ts">
/**
 * 柱状图(Figma `1306:18423` 的 Revenue Trend 每日柱 / Booking Volume Trend 星期柱)。
 *
 * 两种形态:
 * - `inlineLabels=false`(每日营收):柱子等高容器,下方另起一行等距刻度(稿面 8 个日期);
 * - `inlineLabels=true`(星期预订量):每根柱子下面直接跟星期标签,稿面按索引交替主色/次色。
 */
import { computed } from 'vue';
import { barHeights } from '../helpers';

const props = withDefaults(
  defineProps<{
    /** 每根柱:{ label 为刻度文案,value 为原始值 } */
    bars: { label: string; value: number }[];
    axisLabels?: string[];
    height?: number;
    inlineLabels?: boolean;
    /** 稿面 Booking Volume Trend:0/2/4 用主色,1/3/5 用次色 */
    alternate?: boolean;
    minHeight?: number;
  }>(),
  { axisLabels: () => [], height: 203, inlineLabels: false, alternate: false, minHeight: 5 },
);

const columns = computed(() => {
  const heights = barHeights(props.bars.map((bar) => bar.value), 100, props.minHeight);
  return props.bars.map((bar, index) => ({
    key: `${bar.label}-${index}`,
    label: bar.label,
    value: bar.value,
    height: heights[index],
    alt: props.alternate && index % 2 === 1,
  }));
});
</script>

<template>
  <div class="bar-chart">
    <div class="plot" :style="{ height: `${height}px` }">
      <div class="grid-lines">
        <i v-for="line in 4" :key="line" />
      </div>
      <div class="bars" :class="{ inline: inlineLabels }">
        <div v-for="column in columns" :key="column.key" class="bar-col">
          <span class="bar" :class="{ alt: column.alt }" :style="{ height: `${column.height}%` }" />
          <span v-if="inlineLabels" class="bar-label">{{ column.label }}</span>
        </div>
      </div>
    </div>
    <div v-if="!inlineLabels && axisLabels.length" class="x-axis">
      <span v-for="label in axisLabels" :key="label">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.bar-chart {
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

.bars {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 4px;
  padding: 0 20px;

  &.inline {
    align-items: stretch;
    padding: 0;
    gap: 0;
  }
}

.bar-col {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
  height: 100%;
}

.bar {
  display: block;
  width: 100%;
  max-width: 24px;
  border-radius: 4px 4px 0 0;
  background: @ea-primary;

  &.alt {
    background: @ea-primary-chart;
  }
}

.bars.inline .bar {
  width: 28px;
  max-width: 28px;
}

.bar-label {
  color: @ea-ink-aux;
  font-family: @ea-font-body;
  font-size: 10px;
  line-height: 1.5;
}

.x-axis {
  display: flex;
  justify-content: space-between;
  padding: 0 16px;
  color: @ea-ink-aux;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 500;
}
</style>
