<script setup lang="ts">
/**
 * 图表/明细卡外壳(Figma `1306:18423` 的 chart-card / earnings-card /
 * revenue-trend-card / occupancy-rate-card / booking-volume-card / room-type-card)。
 *
 * 稿面这些卡的标题行结构一致(左标题 + 右侧徽标位),差异只在 padding、描边与固定宽度,
 * 故收成一个壳,标题文案与右侧徽标由调用方给。
 */
withDefaults(
  defineProps<{
    title: string;
    /** 稿面 grid 里的卡片带 1px #E2E8F0 描边,financial-row 的 chart-card 不带 */
    bordered?: boolean;
    padding?: number;
  }>(),
  { bordered: false, padding: 24 },
);
</script>

<template>
  <article class="chart-panel" :class="{ bordered }" :style="{ padding: `${padding}px` }">
    <header class="panel-head">
      <h3 class="panel-title">{{ title }}</h3>
      <div class="panel-aside">
        <slot name="aside" />
      </div>
    </header>
    <div class="panel-body">
      <slot />
    </div>
  </article>
</template>

<style scoped lang="less">
@import '../tokens.less';

.chart-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  border-radius: @ea-radius-panel;
  background: #ffffff;
  box-shadow: @ea-shadow-card;

  &.bordered {
    border: 1px solid @ea-line;
  }
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-title {
  margin: 0;
  color: @ea-ink;
  font-family: @ea-font-body;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
}

.panel-aside {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
</style>
