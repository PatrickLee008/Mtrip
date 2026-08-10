<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue';
import PageContainer from '@/components/PageContainer.vue';
import StatusTag from '@/components/StatusTag.vue';
import { useTable } from '@/composables/useTable';
import type { StatusItem } from '@/components/StatusTag.vue';
import { apiComplianceHistory } from '@/api/compliance';

/** 合规审计历史(Super Admin Portal 模块 08) */
const { t } = useI18n();

const RESULT: Record<number, StatusItem> = {
  1: { text: 'Pass', color: 'success' },
  2: { text: 'Warning', color: 'warning' },
  3: { text: 'Fail', color: 'error' },
};

const { loading, list, query, load, search, reset, pagination } = useTable(apiComplianceHistory, {
  result: undefined, merchantId: undefined,
});

const columns = computed(() => [
  { title: t('common.id'), dataIndex: 'id', width: 70 },
  { title: 'Merchant', dataIndex: 'merchant_name', width: 180, ellipsis: true },
  { title: 'Event', dataIndex: 'event', ellipsis: true },
  { title: 'Result', dataIndex: 'result', width: 110 },
  { title: 'Score', dataIndex: 'score', width: 90 },
  { title: 'Reviewer', dataIndex: 'reviewer', width: 120 },
  { title: 'Date', dataIndex: 'event_date', width: 120 },
]);

onMounted(() => { void load(); });
</script>

<template>
  <PageContainer>
    <a-card :bordered="false" class="mtrip-card-shadow" style="margin-bottom: 16px">
      <a-form layout="inline">
        <a-form-item label="Result">
          <a-select v-model:value="query.result" allow-clear placeholder="All" style="width: 130px">
            <a-select-option :value="1">Pass</a-select-option>
            <a-select-option :value="2">Warning</a-select-option>
            <a-select-option :value="3">Fail</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Merchant ID"><a-input-number v-model:value="query.merchantId" :min="1" style="width: 130px" /></a-form-item>
        <a-form-item>
          <a-space>
            <a-button type="primary" @click="search"><template #icon><SearchOutlined /></template>{{ t('common.search') }}</a-button>
            <a-button @click="reset"><template #icon><ReloadOutlined /></template>{{ t('common.reset') }}</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="mtrip-card-shadow">
      <a-table :columns="columns" :data-source="list" :loading="loading" :pagination="pagination" row-key="id" size="middle" :scroll="{ x: 960 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'result'"><StatusTag :value="record.result" :map="RESULT" /></template>
        </template>
      </a-table>
    </a-card>
  </PageContainer>
</template>
