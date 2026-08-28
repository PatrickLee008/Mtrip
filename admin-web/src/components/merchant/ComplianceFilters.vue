<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';
import { complianceCategories } from '@/api/compliance';
defineProps<{ query: Record<string, any> }>();
defineEmits<{ search: []; reset: [] }>();
const { t } = useI18n();
const user = useUserStore();
</script>
<template>
  <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
    <a-form layout="inline">
      <a-form-item v-if="user.isSuper" :label="t('complianceS6.site')"><a-input-number v-model:value="query.siteId" :min="0" /></a-form-item>
      <a-form-item :label="t('complianceS6.merchantId')"><a-input-number v-model:value="query.merchantId" :min="1" /></a-form-item>
      <a-form-item :label="t('complianceS6.keyword')"><a-input v-model:value="query.keyword" allow-clear style="width: 140px" @press-enter="$emit('search')" /></a-form-item>
      <a-form-item :label="t('complianceS6.category')"><a-select v-model:value="query.category" allow-clear style="width: 140px"><a-select-option v-for="c in complianceCategories" :key="c" :value="c">{{ t(`complianceS6.categories.${c}`) }}</a-select-option></a-select></a-form-item>
      <slot />
      <a-form-item><a-space><a-button type="primary" @click="$emit('search')">{{ t('common.search') }}</a-button><a-button @click="$emit('reset')">{{ t('common.reset') }}</a-button></a-space></a-form-item>
    </a-form>
  </a-card>
</template>
