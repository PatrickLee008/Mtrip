<script setup lang="ts">
/**
 * Availability & Pricing 页图标(Figma `1163:16345`)。
 *
 * 稿面用的是 lucide 线性图标(24 网格、stroke 2、round cap/join),与 @ant-design/icons-vue
 * 的实心/异形图标不同形,照稿故在此内联 path,不引第三方图标库。
 */
import { computed } from 'vue';

/**
 * path 逐条取自 lucide 原始定义(`m9 18 6-6-6-6` 这类相对指令**末段符号不能写反**:
 * 写成 `-6 6` 会原路折回,渲染出来只剩一条斜杠)。
 * 校验见 `merchant-web/scripts/check-availability-figma.mjs` 的图标断言。
 */
const PATHS: Record<string, string[]> = {
  bed: ['M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8', 'M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4', 'M12 4v6', 'M2 18h20'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  edit: ['M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'],
  'alert-circle': ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 8v4', 'M12 16h.01'],
  check: ['M20 6 9 17l-5-5'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  'check-circle': ['M21.801 10A10 10 0 1 1 17 3.335', 'm9 11 3 3L22 4'],
};

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 14 });

const paths = computed(() => PATHS[props.name] ?? []);
</script>

<template>
  <svg
    class="av-icon"
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
.av-icon {
  display: block;
  flex: none;
}
</style>
