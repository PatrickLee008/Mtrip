<script setup lang="ts">
import { computed } from 'vue';

/**
 * KPI 统计卡(Super Admin Portal 设计规范「StatCard」)
 * 图标 + 等宽大号数值 + 标签 + 可选环比徽标 + 可选 sparkline。
 * 令牌见 styles/index.less 的 --sap-*。
 */
const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number;
    /** 说明/环比文案 */
    sub?: string;
    /** 主色(数值 + 图标底色),默认品牌蓝 */
    color?: string;
    /** 趋势方向:up 绿 / down 红 / null 不显示箭头 */
    trend?: 'up' | 'down' | null;
    /** 百分比徽标文案,如 "+12.4%" */
    pct?: string;
    /** 10 点迷你走势(可选) */
    spark?: number[];
  }>(),
  { color: 'var(--sap-brand)', trend: null },
);

/** 数值数组 → SVG 折线 path(线性归一化) */
const sparkPath = computed(() => {
  const d = props.spark;
  if (!d || d.length < 2) return '';
  const w = 80;
  const h = 28;
  const min = Math.min(...d);
  const max = Math.max(...d);
  const span = max - min || 1;
  return d
    .map((v, i) => {
      const x = (i / (d.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});

const trendColor = computed(() =>
  props.trend === 'up' ? 'var(--sap-success)' : props.trend === 'down' ? 'var(--sap-danger)' : 'var(--sap-muted)',
);
</script>

<template>
  <div class="stat-card mtrip-card-shadow">
    <div class="stat-top">
      <span class="stat-icon" :style="{ background: color + '18', color }">
        <slot name="icon" />
      </span>
      <svg v-if="sparkPath" class="stat-spark" viewBox="0 0 80 28" preserveAspectRatio="none">
        <path :d="sparkPath" fill="none" :stroke="color" stroke-width="1.5" />
      </svg>
    </div>
    <div class="stat-value" :style="{ color }">{{ value }}</div>
    <div class="stat-label-row">
      <span class="stat-label">{{ label }}</span>
      <span v-if="pct" class="stat-pct" :style="{ color: trendColor }">
        <span v-if="trend === 'up'">▲</span><span v-else-if="trend === 'down'">▼</span>
        {{ pct }}
      </span>
    </div>
    <div v-if="sub" class="stat-sub">{{ sub }}</div>
  </div>
</template>

<style scoped lang="less">
.stat-card {
  background: var(--sap-card);
  border: 1px solid var(--sap-border);
  border-radius: 8px;
  padding: 14px 16px;
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  font-size: 15px;
}

.stat-spark {
  width: 80px;
  height: 28px;
}

.stat-value {
  font-family: var(--sap-font-mono);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--sap-muted);
}

.stat-pct {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.stat-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--sap-muted);
}
</style>
