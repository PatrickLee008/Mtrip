<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * 状态标签:全平台统一语义色(UI 方案 2.1 状态色)
 * 通用映射:1 启用/成功(绿) 2 禁用/失败(红);可用 map 覆盖
 */
export interface StatusItem {
  text: string;
  color: 'success' | 'warning' | 'error' | 'default' | 'processing' | 'cyan' | 'orange' | 'purple';
}

const props = defineProps<{
  value: number | string;
  /** 自定义映射:{ 1: {text:'启用', color:'success'} } */
  map?: Record<string | number, StatusItem>;
}>();

const { t } = useI18n();

const DEFAULT_MAP: Record<string | number, StatusItem> = {
  1: { text: t('status.enabled'), color: 'success' },
  2: { text: t('status.disabled'), color: 'error' },
};

const item = computed<StatusItem>(() => {
  const source = props.map ?? DEFAULT_MAP;
  return source[props.value] ?? { text: String(props.value), color: 'default' };
});
</script>

<template>
  <a-tag :color="item.color">{{ item.text }}</a-tag>
</template>
