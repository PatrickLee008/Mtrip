<script setup lang="ts">
/**
 * 概览卡(Figma `1306:18423` summary-row 的四张卡)。
 *
 * 稿面结构:标签 + 右上角 36×36 圆形图标底 + 大号值(Plus Jakarta Sans Bold 28)+ 副文案。
 * 三种取值形态由插槽承载:纯副文案、迷你柱(Occupancy Rate)、危险态(Pending Actions 全红)。
 */
withDefaults(
  defineProps<{
    label: string;
    value: string;
    sub?: string;
    /** danger = Pending Actions(值与副文案均取稿面危险色) */
    tone?: 'default' | 'danger';
  }>(),
  { sub: '', tone: 'default' },
);
</script>

<template>
  <article class="summary-card" :class="`tone-${tone}`">
    <header class="card-header">
      <span class="card-label">{{ label }}</span>
      <span class="icon-wrapper">
        <slot name="icon" />
      </span>
    </header>
    <div class="card-body">
      <div class="card-value">{{ value }}</div>
      <slot name="body">
        <div class="card-sub">{{ sub }}</div>
      </slot>
    </div>
  </article>
</template>

<style scoped lang="less">
@import '../tokens.less';

.summary-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: @ea-radius-card;
  background: #ffffff;
  box-shadow: @ea-shadow-card;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-label {
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 14px;
  font-weight: 500;
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background: @ea-primary-chip;
  color: @ea-primary;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-value {
  color: @ea-ink;
  font-family: @ea-font-display;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.card-sub {
  color: @ea-ink-muted;
  font-family: @ea-font-body;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}

.tone-danger {
  .icon-wrapper {
    background: @ea-danger-soft;
    color: @ea-danger;
  }

  .card-value,
  .card-sub {
    color: @ea-danger;
  }
}
</style>
