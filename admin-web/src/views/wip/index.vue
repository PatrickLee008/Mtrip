<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageContainer from '@/components/PageContainer.vue';

/** 未实现页面统一占位:动态路由解析不到对应组件时使用 */
const { t } = useI18n();
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-empty :description="t('app.wipTip')">
        <template #image>
          <span style="font-size: 48px">🚧</span>
        </template>
      </a-empty>
    </a-card>
  </PageContainer>
</template>
