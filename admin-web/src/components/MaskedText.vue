<script setup lang="ts">
import { useI18n } from 'vue-i18n';

/**
 * 脱敏显示:后端已脱敏字段统一灰色小字 + 「已脱敏」标注(GDPR 合规,UI 方案 2.5)
 */
withDefaults(
  defineProps<{
    value?: string | null;
    /** 是否展示「已脱敏」标注 */
    badge?: boolean;
  }>(),
  { value: '', badge: false },
);

const { t } = useI18n();
</script>

<template>
  <span class="masked-text">
    <span class="masked-value">{{ value || '-' }}</span>
    <a-tag v-if="badge && value" class="masked-badge" :bordered="false">{{ t('common.masked') }}</a-tag>
  </span>
</template>

<style scoped lang="less">
.masked-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .masked-value {
    color: var(--mtrip-text-secondary);
    font-family: monospace;
  }

  .masked-badge {
    color: var(--mtrip-text-aux);
    font-size: 12px;
    line-height: 18px;
    margin-inline-end: 0;
  }
}
</style>
