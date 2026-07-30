<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const { t } = useI18n();
</script>

<template>
  <div class="error-page">
    <a-result status="404" title="404" :sub-title="t('error.notFound')">
      <template #extra>
        <a-button type="primary" @click="router.push('/')">{{ t('error.backHome') }}</a-button>
      </template>
    </a-result>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
