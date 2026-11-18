<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { apiMerchantNotifyTemplates, apiOnboardingKycTemplates } from '@/api/merchant';
import type { Row } from '@/api/config';
import { useUserStore } from '@/stores/user';

const props = defineProps<{ kind: 'onboarding' | 'notifications' }>();
const { t } = useI18n();
const user = useUserStore();
const rows = ref<Row[]>([]);
const loading = ref(false);
const failed = ref(false);
const columns = computed(() => [
  { title: t('platformConfig.templateName'), key: 'name' },
  { title: t('platformConfig.scope'), dataIndex: 'site_id', width: 120 },
  { title: t(`platformConfig.${props.kind === 'onboarding' ? 'documents' : 'content'}`), key: 'content' },
]);

async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  rows.value = [];
  try {
    const result = props.kind === 'onboarding' ? await apiOnboardingKycTemplates() : await apiMerchantNotifyTemplates();
    rows.value = user.profile?.isSuper === true ? result : result.filter(row => Number(row.site_id) === 0 || Number(row.site_id) === user.profile?.siteId);
  } catch {
    failed.value = true;
  } finally {
    loading.value = false;
  }
}

function documents(row: Row): Row[] {
  if (Array.isArray(row.docs)) return row.docs;
  try {
    const value = JSON.parse(row.docs || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

watch(() => props.kind, load, { immediate: true });
</script>

<template>
  <a-card :bordered="false" class="mtrip-card-shadow">
    <template #title>{{ t(`platformConfig.sections.${kind}.title`) }}</template>
    <template #extra><a-space wrap><a-button disabled>{{ t('platformConfig.createTemplate') }}</a-button><a-button :loading="loading" @click="load"><ReloadOutlined />{{ t('common.refresh') }}</a-button></a-space></template>
    <a-alert v-if="failed" type="error" show-icon :message="t('platformConfig.loadFailed')">
      <template #action><a-button size="small" @click="load">{{ t('platformConfig.retry') }}</a-button></template>
    </a-alert>
    <a-table v-else :columns="columns" :data-source="rows" :loading="loading" row-key="id" :pagination="false" :scroll="{ x: 620 }" :locale="{ emptyText: t('platformConfig.templateEmpty') }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">{{ kind === 'onboarding' ? record.name : record.title }}</template>
        <template v-else-if="column.dataIndex === 'site_id'">{{ Number(record.site_id) === 0 ? t('platformConfig.global') : record.site_id }}</template>
        <template v-else-if="column.key === 'content'">
          <ul v-if="kind === 'onboarding'" class="template-docs">
            <li v-for="(doc, index) in documents(record)" :key="index">
              {{ doc.name }} <a-tag :color="doc.required ? 'blue' : 'default'">{{ t(`platformConfig.${doc.required ? 'required' : 'optional'}`) }}</a-tag>
            </li>
          </ul>
          <div v-else class="template-message">{{ record.message }}</div>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<style scoped lang="less">
.template-docs { margin: 0; padding-left: 18px; li + li { margin-top: 8px; } }
.template-message { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
