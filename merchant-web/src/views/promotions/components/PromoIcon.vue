<script setup lang="ts">
/**
 * Promotions 页图标(Figma `2285:21516`)。
 *
 * 稿面用的是 lucide 线性图标(24 网格、stroke 2、round cap/join),与 @ant-design/icons-vue
 * 的实心/异形图标不同形,照稿故在此内联 path,不引第三方图标库。
 *
 * ⚠ path 逐条取自 lucide 原始几何定义。相对指令(`m9 18 6-6-6-6` 这类)**末段符号不能写反**,
 * 写成 `-6 6` 会原路折回、渲染出来只剩一条斜杠(availability 页踩过一次)。
 * 圆形统一用「两段半圆弧」写法 `M{cx-r} {cy}a{r} {r} 0 1 0 {2r} 0a{r} {r} 0 1 0 -{2r} 0z`。
 */
import { computed } from 'vue';

const PATHS: Record<string, string[]> = {
  // —— 促销形态 ——
  percent: ['M19 5 5 19', 'M4 6.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z', 'M15 17.5a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0z'],
  'ticket-percent': [
    'M4 5h16a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 1 2-2z',
    'M9 9h.01',
    'm15 9-6 6',
    'M15 15h.01',
  ],
  ticket: [
    'M4 5h16a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6V7a2 2 0 0 1 2-2z',
    'M13 5v2',
    'M13 17v2',
    'M13 11v2',
  ],
  banknote: [
    'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M6 12h.01',
    'M18 12h.01',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],

  // —— 操作 ——
  plus: ['M5 12h14', 'M12 5v14'],
  edit: [
    'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z',
  ],
  copy: [
    'M8 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z',
    'M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
  ],
  pause: [
    'M15 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
    'M7 4h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  ],
  play: ['m6 3 14 9-14 9V3z'],
  'play-circle': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'm10 8 6 4-6 4V8z'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  check: ['M20 6 9 17l-5-5'],
  'check-circle': ['M21.801 10A10 10 0 1 1 17 3.335', 'm9 11 3 3L22 4'],
  'x-circle': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'm15 9-6 6', 'm9 9 6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  ],
  search: ['m21 21-4.34-4.34', 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z'],
  filter: ['M3 5h18', 'M7 12h10', 'M10 19h4'],

  // —— 效果分析 ——
  eye: [
    'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  'trending-up': ['M16 7h6v6', 'm22 7-8.5 8.5-5-5L2 17'],
  target: [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12z',
    'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  ],
  coins: [
    'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2z',
    'M18.09 10.37A6 6 0 1 1 10.34 18',
    'M7 6h1v4',
    'm16.71 13.88.7.71-2.82 2.82',
  ],
  'shopping-bag': ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],

  // —— 平台活动 ——
  megaphone: ['m3 11 18-5v12L3 14v-3z', 'M11.6 16.8a3 3 0 1 1-5.8-1.6'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  'file-text': ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  wallet: [
    'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5',
    'M18 12h.01',
  ],
};

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 14 });

const paths = computed(() => PATHS[props.name] ?? []);
</script>

<template>
  <svg
    class="pr-icon"
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
.pr-icon {
  display: block;
  flex: none;
}
</style>
