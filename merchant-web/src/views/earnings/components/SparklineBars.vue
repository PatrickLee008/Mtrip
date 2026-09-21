<script setup lang="ts">
/**
 * 入住率迷你柱(Figma `1306:18423` sparkline-container):
 * 20px 高条带内若干 8px 宽、2px 圆角的柱子,高度按区间入住率归一化。
 */
import { computed } from 'vue';
import { sparklineHeights } from '../helpers';

const props = withDefaults(
  defineProps<{
    /** 入住率序列(取末尾若干天) */
    values: (number | null)[];
    count?: number;
  }>(),
  { count: 6 },
);

const bars = computed(() => {
  const picked = props.values.slice(Math.max(0, props.values.length - props.count));
  return sparklineHeights(picked).map((height, index) => ({ key: index, height }));
});
</script>

<template>
  <div class="sparkline" role="img">
    <span v-for="bar in bars" :key="bar.key" class="spark-bar" :style="{ height: `${bar.height}px` }" />
  </div>
</template>

<style scoped lang="less">
@import '../tokens.less';

.sparkline {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 20px;
}

.spark-bar {
  display: block;
  width: 8px;
  border-radius: 2px;
  background: @ea-primary;
}
</style>
