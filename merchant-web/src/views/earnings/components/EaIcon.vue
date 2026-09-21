<script setup lang="ts">
/**
 * Dashboard & Earnings 页图标(Figma `1306:18423`)。
 *
 * 稿面用的是 lucide 线性图标(24 网格、stroke 2、round cap/join),与 @ant-design/icons-vue
 * 的实心/异形图标不同形,照稿故在此内联 path,不引第三方图标库。
 *
 * ⚠ path 逐条取自 lucide 原始几何定义。相对指令末段符号不能写反(availability 页踩过:
 * `m9 18 6-6-6-6` 写成 `-6 6` 会原路折回、只剩一条斜杠)。
 * 圆形统一用「两段半圆弧」写法 `M{cx-r} {cy}a{r} {r} 0 1 0 {2r} 0a{r} {r} 0 1 0 -{2r} 0z`。
 */
import { computed } from 'vue';

const PATHS: Record<string, string[]> = {
  'log-in': ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'm10 17 5-5-5-5', 'M15 12H3'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  percent: [
    'M19 5 5 19',
    'M4 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z',
    'M15 17.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z',
  ],
  'alert-triangle': [
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    'M12 9v4',
    'M12 17h.01',
  ],
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  ],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'file-text': [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
  ],
  x: ['M18 6 6 18', 'm6 6 12 12'],
};

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });

const paths = computed(() => PATHS[props.name] ?? []);
</script>

<template>
  <svg
    class="ea-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, index) in paths" :key="index" :d="d" />
  </svg>
</template>

<style scoped>
.ea-icon {
  display: block;
  flex: none;
}
</style>
